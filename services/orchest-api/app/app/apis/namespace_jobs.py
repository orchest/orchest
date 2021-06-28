import copy
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Set, Tuple

from celery.contrib.abortable import AbortableAsyncResult
from croniter import croniter
from docker import errors
from flask import abort, current_app, request
from flask_restx import Namespace, Resource, marshal
from sqlalchemy import desc, func
from sqlalchemy.orm import joinedload, undefer

import app.models as models
from _orchest.internals import config as _config
from _orchest.internals.two_phase_executor import TwoPhaseExecutor, TwoPhaseFunction
from app import schema
from app.celery_app import make_celery
from app.connections import db
from app.core.pipelines import Pipeline, construct_pipeline
from app.utils import (
    get_env_uuids_missing_image,
    get_proj_pip_env_variables,
    lock_environment_images_for_job,
    process_stale_environment_images,
    register_schema,
    update_status_db,
)

api = Namespace("jobs", description="Managing jobs")
api = register_schema(api)


@api.route("/")
class JobList(Resource):
    @api.doc("get_jobs")
    @api.marshal_with(schema.jobs)
    def get(self):
        """Fetches all jobs.

        The jobs are either in queue, running or already
        completed.

        """
        jobs = models.Job.query
        if "project_uuid" in request.args:
            jobs = jobs.filter_by(project_uuid=request.args["project_uuid"])

        jobs = jobs.order_by(desc(models.Job.created_time)).all()
        jobs = [job.__dict__ for job in jobs]

        return {"jobs": jobs}

    @api.doc("start_job")
    @api.expect(schema.job_spec)
    def post(self):
        """Drafts a new job. Locks environment images for all its runs.

        The environment images used by a job across its entire lifetime,
        and thus its runs, will be the same. This is done by locking the
        actual resource (docker image) that is backing the environment,
        so that a new build of the environment will not affect the job.
        To actually queue the job you need to issue a PUT request for
        the DRAFT job you create here. The PUT needs to contain the
        `confirm_draft` key.

        """
        # TODO: possibly use marshal() on the post_data. Note that we
        # have moved over to using flask_restx
        # https://flask-restx.readthedocs.io/en/stable/api.html#flask_restx.marshal
        #       to make sure the default values etc. are filled in.
        try:
            with TwoPhaseExecutor(db.session) as tpe:
                job = CreateJob(tpe).transaction(request.get_json())
        except Exception as e:
            current_app.logger.error(e)
            return {"message": str(e)}, 500

        return marshal(job, schema.job), 201


@api.route("/<string:job_uuid>")
@api.param("job_uuid", "UUID of job")
@api.response(404, "Job not found")
class Job(Resource):
    @api.doc("get_job")
    @api.marshal_with(schema.job, code=200)
    def get(self, job_uuid):
        """Fetches a job given its UUID."""
        job = (
            models.Job.query.options(undefer(models.Job.env_variables))
            # joinedload is to also fetch pipeline_runs.
            .options(
                joinedload(models.Job.pipeline_runs).undefer(
                    models.NonInteractivePipelineRun.env_variables
                )
            )
            .filter_by(uuid=job_uuid)
            .one_or_none()
        )
        if job is None:
            abort(404, "Job not found.")
        return job

    @api.expect(schema.job_update)
    @api.doc("update_job")
    def put(self, job_uuid):
        """Update a job (cronstring or parameters).

        Update a job cron schedule or parameters. Updating the cron
        schedule implies that the job will be rescheduled and will
        follow the new given schedule. Updating the parameters of a job
        implies that the next time the job will be run those parameters
        will be used, thus affecting the number of pipeline runs that
        are launched. Only recurring ongoing jobs can be updated.

        """

        job_update = request.get_json()

        cron_schedule = job_update.get("cron_schedule", None)
        parameters = job_update.get("parameters", None)
        env_variables = job_update.get("env_variables", None)
        next_scheduled_time = job_update.get("next_scheduled_time", None)
        strategy_json = job_update.get("strategy_json", None)
        confirm_draft = "confirm_draft" in job_update

        try:
            with TwoPhaseExecutor(db.session) as tpe:
                UpdateJob(tpe).transaction(
                    job_uuid,
                    cron_schedule,
                    parameters,
                    env_variables,
                    next_scheduled_time,
                    strategy_json,
                    confirm_draft,
                )
        except Exception as e:
            current_app.logger.error(e)
            db.session.rollback()
            return {"message": str(e)}, 500

        return {"message": "Job was updated successfully"}, 200

    # TODO: We should also make it possible to stop a particular
    # pipeline run of a job. It should state "cancel" the
    # execution of a pipeline run, since we do not do termination of
    # running tasks.
    @api.doc("delete_job")
    @api.response(200, "Job terminated")
    def delete(self, job_uuid):
        """Stops a job given its UUID.

        However, it will not delete any corresponding database entries,
        it will update the status of corresponding objects to "ABORTED".
        """

        try:
            with TwoPhaseExecutor(db.session) as tpe:
                could_abort = AbortJob(tpe).transaction(job_uuid)
        except Exception as e:
            return {"message": str(e)}, 500

        if could_abort:
            return {"message": "Job termination was successful."}, 200
        else:
            return {"message": "Job does not exist or is already completed."}, 404


@api.route(
    "/<string:job_uuid>/<string:run_uuid>",
    doc={"description": ("Set and get execution status of pipeline runs " "in a job.")},
)
@api.param("job_uuid", "UUID of Job")
@api.param("run_uuid", "UUID of Run")
@api.response(404, "Pipeline run not found")
class PipelineRun(Resource):
    @api.doc("get_pipeline_run")
    @api.marshal_with(schema.non_interactive_run, code=200)
    def get(self, job_uuid, run_uuid):
        """Fetch a pipeline run of a job given their ids."""
        non_interactive_run = (
            models.NonInteractivePipelineRun.query.options(
                undefer(models.NonInteractivePipelineRun.env_variables)
            )
            .filter_by(
                uuid=run_uuid,
            )
            .one_or_none()
        )
        if non_interactive_run is None:
            abort(404, "Given job has no run with given run_uuid")
        return non_interactive_run.__dict__

    @api.doc("set_pipeline_run_status")
    @api.expect(schema.status_update)
    def put(self, job_uuid, run_uuid):
        """Set the status of a pipeline run."""

        try:
            with TwoPhaseExecutor(db.session) as tpe:
                UpdateJobPipelineRun(tpe).transaction(
                    job_uuid, run_uuid, request.get_json()
                )
        except Exception as e:
            current_app.logger.error(e)
            return {"message": str(e)}, 500

        return {"message": "Status was updated successfully"}, 200


@api.route(
    "/<string:job_uuid>/<string:run_uuid>/<string:step_uuid>",
    doc={
        "description": (
            "Set and get execution status of individual steps of "
            "pipeline runs in a job."
        )
    },
)
@api.param("job_uuid", "UUID of Job")
@api.param("run_uuid", "UUID of Run")
@api.param("step_uuid", "UUID of Step")
@api.response(404, "Pipeline step not found")
class PipelineStepStatus(Resource):
    @api.doc("get_pipeline_run_pipeline_step")
    @api.marshal_with(schema.non_interactive_run, code=200)
    def get(self, job_uuid, run_uuid, step_uuid):
        """Fetch a pipeline step of a job run given uuids."""
        step = models.PipelineRunStep.query.get_or_404(
            ident=(run_uuid, step_uuid),
            description="Combination of given job, run and step not found",
        )
        return step.__dict__

    @api.doc("set_pipeline_run_pipeline_step_status")
    @api.expect(schema.status_update)
    def put(self, job_uuid, run_uuid, step_uuid):
        """Set the status of a pipeline step of a pipeline run."""
        status_update = request.get_json()

        filter_by = {
            "run_uuid": run_uuid,
            "step_uuid": step_uuid,
        }
        try:
            update_status_db(
                status_update,
                model=models.PipelineRunStep,
                filter_by=filter_by,
            )
            db.session.commit()
        except Exception:
            db.session.rollback()
            return {"message": "Failed update operation."}, 500

        return {"message": "Status was updated successfully."}, 200


@api.route("/cleanup/<string:job_uuid>")
@api.param("job_uuid", "UUID of job")
@api.response(404, "Job not found")
class JobDeletion(Resource):
    @api.doc("delete_job")
    @api.response(200, "Job deleted")
    def delete(self, job_uuid):
        """Delete a job.

        The job is stopped if its running, related entities
        are then removed from the db.
        """

        try:
            with TwoPhaseExecutor(db.session) as tpe:
                could_delete = DeleteJob(tpe).transaction(job_uuid)
        except Exception as e:
            return {"message": str(e)}, 500

        if could_delete:
            return {"message": "Job deletion was successful."}, 200
        else:
            return {"message": "Job does not exist."}, 404


class RunJob(TwoPhaseFunction):
    """Start the pipeline runs related to a job"""

    def _transaction(self, job_uuid: str):

        # with_entities is so that we do not retrieve the interactive
        # runs of the job, since we do not need those.
        job = (
            models.Job.query.with_entities(models.Job)
            # Use with_for_update so that the job entry will be locked
            # until commit, so that if, for whatever reason, the same
            # job is launched concurrently the different launchs will
            # actually be serialized, i.e. one has to wait for the
            # commit of the other, so that the launched runs will
            # correctly refer to a different total_scheduled_executions
            # number.
            # https://docs.sqlalchemy.org/en/13/orm/query.html#sqlalchemy.orm.query.Query.with_for_update
            # https://www.postgresql.org/docs/9.0/sql-select.html#SQL-FOR-UPDATE-SHARE
            .with_for_update()
            .filter_by(uuid=job_uuid)
            .one()
        )
        # In case the job gets aborted while the scheduler attempts to
        # run it.
        if job.status == "ABORTED":
            self.collateral_kwargs["job"] = dict()
            self.collateral_kwargs["tasks_to_launch"] = []
            self.collateral_kwargs["run_config"] = dict()

        # The status of jobs that run once is initially set to PENDING,
        # thus we need to update that.
        if job.status == "PENDING":
            job.status = "STARTED"

        # To be later used by the collateral effect function.
        tasks_to_launch = []

        # The number of pipeline runs of a job, across all job runs. We
        # could use 'count' but 'max' is safer, if for any reason a
        # pipeline run is not there, e.g. if pipeline runs 0 and 2 are
        # there, but not 1, 'count' would keep returning 2, and no runs
        # could be launched anymore because of the (job_uuid,
        # pipeline_run_index) constraint.
        pipeline_run_index = (
            db.session.query(
                func.max(models.NonInteractivePipelineRun.pipeline_run_index)
            )
            .filter_by(job_uuid=job_uuid)
            .one()
        )[0]
        if pipeline_run_index is None:
            pipeline_run_index = 0
        else:
            pipeline_run_index += 1

        # run_index is the index of the run within the runs of this job
        # scheduling/execution.
        for run_index, run_parameters in enumerate(job.parameters):
            pipeline_def = copy.deepcopy(job.pipeline_definition)

            # Set the pipeline parameters:
            pipeline_def["parameters"] = run_parameters.get(
                _config.PIPELINE_PARAMETERS_RESERVED_KEY, {}
            )

            # Set the steps parameters in the pipeline definition.
            for step_uuid, step_parameters in run_parameters.items():
                # One of the entries is not actually a step_uuid.
                if step_uuid != _config.PIPELINE_PARAMETERS_RESERVED_KEY:
                    pipeline_def["steps"][step_uuid]["parameters"] = step_parameters

            # Instantiate a pipeline object given the specs, definition
            # and parameters.
            pipeline_run_spec = copy.deepcopy(job.pipeline_run_spec)
            pipeline_run_spec["pipeline_definition"] = pipeline_def
            pipeline = construct_pipeline(**pipeline_run_spec)

            # Specify the task_id beforehand to avoid race conditions
            # between the task and its presence in the db.
            task_id = str(uuid.uuid4())
            tasks_to_launch.append((task_id, pipeline))

            non_interactive_run = {
                "job_uuid": job.uuid,
                "uuid": task_id,
                "pipeline_uuid": job.pipeline_uuid,
                "project_uuid": job.project_uuid,
                "status": "PENDING",
                "parameters": run_parameters,
                "job_run_index": job.total_scheduled_executions,
                "job_run_pipeline_run_index": run_index,
                "pipeline_run_index": pipeline_run_index,
                "env_variables": job.env_variables,
            }
            pipeline_run_index += 1

            db.session.add(models.NonInteractivePipelineRun(**non_interactive_run))
            # Need to flush because otherwise the bulk insertion of
            # pipeline steps will lead to foreign key errors.
            # https://docs.sqlalchemy.org/en/13/orm/persistence_techniques.html#bulk-operations-caveats
            db.session.flush()

            # TODO: this code is also in `namespace_runs`. Could
            #       potentially be put in a function for modularity.
            # Set an initial value for the status of the pipeline
            # steps that will be run.
            step_uuids = [s.properties["uuid"] for s in pipeline.steps]
            pipeline_steps = []
            for step_uuid in step_uuids:
                pipeline_steps.append(
                    models.PipelineRunStep(
                        **{
                            "run_uuid": task_id,
                            "step_uuid": step_uuid,
                            "status": "PENDING",
                        }
                    )
                )
            db.session.bulk_save_objects(pipeline_steps)

        job.total_scheduled_executions += 1

        # Prepare data for _collateral.
        self.collateral_kwargs["job"] = job.as_dict()

        mappings = {
            mapping.orchest_environment_uuid: mapping.docker_img_id
            for mapping in job.image_mappings
        }
        run_config = job.pipeline_run_spec["run_config"]
        run_config["env_uuid_docker_id_mappings"] = mappings
        run_config["user_env_variables"] = job.env_variables
        self.collateral_kwargs["run_config"] = run_config

        self.collateral_kwargs["tasks_to_launch"] = tasks_to_launch

    def _collateral(
        self,
        job: Dict[str, Any],
        run_config: Dict[str, Any],
        tasks_to_launch: Tuple[str, Pipeline],
    ):
        # Safety check in case the job has no runs.
        if not tasks_to_launch:
            return

        # Launch each task through celery.
        celery = make_celery(current_app)

        for task_id, pipeline in tasks_to_launch:
            celery_job_kwargs = {
                "job_uuid": job["uuid"],
                "project_uuid": job["project_uuid"],
                "pipeline_definition": pipeline.to_dict(),
                "run_config": run_config,
            }

            # Due to circular imports we use the task name instead of
            # importing the function directly.
            task_args = {
                "name": "app.core.tasks.start_non_interactive_pipeline_run",
                "kwargs": celery_job_kwargs,
                "task_id": task_id,
            }
            res = celery.send_task(**task_args)
            # NOTE: this is only if a backend is configured. The task
            # does not return anything. Therefore we can forget its
            # result and make sure that the Celery backend releases
            # recourses (for storing and transmitting results)
            # associated to the task. Uncomment the line below if
            # applicable.
            res.forget()

    def _revert(self):
        job = self.collateral_kwargs["job"]
        # Jobs that run only once are considered as entirely failed.
        if job["schedule"] is None:
            models.Job.query.filter_by(uuid=job["uuid"]).update({"status": "FAILURE"})

        tasks_ids = [task[0] for task in self.collateral_kwargs["tasks_to_launch"]]

        # Set the status to FAILURE for runs and their steps.
        models.PipelineRunStep.query.filter(
            models.PipelineRunStep.run_uuid.in_(tasks_ids)
        ).update({"status": "FAILURE"}, synchronize_session=False)

        models.NonInteractivePipelineRun.query.filter(
            models.PipelineRun.uuid.in_(tasks_ids)
        ).update({"status": "FAILURE"}, synchronize_session=False)
        db.session.commit()


class AbortJob(TwoPhaseFunction):
    """Abort a job."""

    def _transaction(self, job_uuid: str):
        # To be later used by the collateral function.
        run_uuids = []
        # Assign asap since the function will return if there is nothing
        # to do.
        self.collateral_kwargs["run_uuids"] = run_uuids
        self.collateral_kwargs["job_uuid"] = job_uuid
        self.collateral_kwargs["project_uuid"] = None

        job = (
            models.Job.query.options(joinedload(models.Job.pipeline_runs))
            .filter_by(uuid=job_uuid)
            .one_or_none()
        )
        if job is None:
            return False

        self.collateral_kwargs["project_uuid"] = job.project_uuid

        # No op if the job is already in an end state.
        if job.status in ["SUCCESS", "FAILURE", "ABORTED"]:
            return

        job.status = "ABORTED"
        # This way a recurring job or a job which is scheduled to run
        # once in the future will not be scheduled anymore.
        job.next_scheduled_time = None

        # Store each uuid of runs that can still be aborted. These uuid
        # are the celery task uuid as well.
        for run in job.pipeline_runs:
            if run.status in ["PENDING", "STARTED"]:
                run_uuids.append(run.uuid)

        # Set the state of each run and related steps to ABORTED. Note
        # that the status of steps that have already been completed will
        # not be modified.
        for run_uuid in run_uuids:
            filter_by = {"uuid": run_uuid}
            status_update = {"status": "ABORTED"}

            update_status_db(
                status_update,
                model=models.NonInteractivePipelineRun,
                filter_by=filter_by,
            )

            filter_by = {"run_uuid": run_uuid}
            status_update = {"status": "ABORTED"}

            update_status_db(
                status_update, model=models.PipelineRunStep, filter_by=filter_by
            )

        return True

    def _collateral(self, project_uuid: str, run_uuids: List[str], **kwargs):
        # Aborts and revokes all pipeline runs and waits for a reply for
        # 1.0s.
        celery = make_celery(current_app)
        celery.control.revoke(run_uuids, timeout=1.0)

        for run_uuid in run_uuids:
            res = AbortableAsyncResult(run_uuid, app=celery)
            # It is responsibility of the task to terminate by reading
            # its aborted status.
            res.abort()

        if project_uuid is not None:
            process_stale_environment_images(project_uuid)


class CreateJob(TwoPhaseFunction):
    """Create a job."""

    def _transaction(
        self,
        job_spec: Dict[str, Any],
    ) -> models.Job:
        scheduled_start = job_spec.get("scheduled_start", None)
        cron_schedule = job_spec.get("cron_schedule", None)

        # To be scheduled ASAP and to be run once.
        if cron_schedule is None and scheduled_start is None:
            next_scheduled_time = None

        # To be scheduled according to argument, to be run once.
        elif cron_schedule is None:
            # Expected to be UTC.
            next_scheduled_time = datetime.fromisoformat(scheduled_start)

        # To follow a cron schedule. To be run an indefinite amount
        # of times.
        elif cron_schedule is not None and scheduled_start is None:
            if not croniter.is_valid(cron_schedule):
                raise ValueError(f"Invalid cron schedule: {cron_schedule}")

            # Check when is the next time the job should be
            # scheduled starting from now.
            next_scheduled_time = croniter(
                cron_schedule, datetime.now(timezone.utc)
            ).get_next(datetime)

        else:
            raise ValueError("Can't define both cron_schedule and scheduled_start.")

        job = {
            "uuid": job_spec["uuid"],
            "name": job_spec["name"],
            "project_uuid": job_spec["project_uuid"],
            "pipeline_uuid": job_spec["pipeline_uuid"],
            "pipeline_name": job_spec["pipeline_name"],
            "schedule": cron_schedule,
            "parameters": job_spec["parameters"],
            "env_variables": get_proj_pip_env_variables(
                job_spec["project_uuid"], job_spec["pipeline_uuid"]
            ),
            # NOTE: the definition of a service is currently
            # persisted to disk and considered to be versioned,
            # meaning that nothing in there is considered to be
            # secret. If this changes, this dictionary needs to have
            # secrets removed.
            "pipeline_definition": job_spec["pipeline_definition"],
            "pipeline_run_spec": job_spec["pipeline_run_spec"],
            "total_scheduled_executions": 0,
            "next_scheduled_time": next_scheduled_time,
            "status": "DRAFT",
            "strategy_json": job_spec.get("strategy_json", {}),
            "created_time": datetime.now(timezone.utc),
        }
        db.session.add(models.Job(**job))

        self.collateral_kwargs["project_uuid"] = job_spec["project_uuid"]
        self.collateral_kwargs["job_uuid"] = job_spec["uuid"]
        spec = copy.deepcopy(job_spec["pipeline_run_spec"])
        spec["pipeline_definition"] = job_spec["pipeline_definition"]
        pipeline = construct_pipeline(**spec)
        self.collateral_kwargs["environment_uuids"] = pipeline.get_environments()
        return job

    def _collateral(
        self, project_uuid: str, job_uuid: str, environment_uuids: Set[str]
    ):
        # This way all runs of a job will use the same environments. The
        # images to use will be retrieved through the JobImageMapping
        # model.
        lock_environment_images_for_job(job_uuid, project_uuid, environment_uuids)

    def _revert(self):
        models.Job.query.filter_by(
            uuid=self.collateral_kwargs["job_uuid"],
        ).delete()
        db.session.commit()


class UpdateJob(TwoPhaseFunction):
    """Update a job."""

    def _transaction(
        self,
        job_uuid: str,
        cron_schedule: str,
        parameters: Dict[str, Any],
        env_variables: Dict[str, str],
        next_scheduled_time: str,
        strategy_json: Dict[str, Any],
        confirm_draft,
    ):
        job = models.Job.query.with_for_update().filter_by(uuid=job_uuid).one()

        if cron_schedule is not None:
            if job.schedule is None and job.status != "DRAFT":
                raise ValueError(
                    (
                        "Failed update operation. Cannot set the schedule of a "
                        "job which is not a cron job already."
                    )
                )

            if not croniter.is_valid(cron_schedule):
                raise ValueError(
                    f"Failed update operation. Invalid cron schedule: {cron_schedule}"
                )

            # Check when is the next time the job should be scheduled
            # starting from now.
            job.schedule = cron_schedule

            job.next_scheduled_time = croniter(
                cron_schedule, datetime.now(timezone.utc)
            ).get_next(datetime)

        if parameters is not None:
            if job.schedule is None and job.status != "DRAFT":
                raise ValueError(
                    (
                        "Failed update operation. Cannot update the parameters of "
                        "a job which is not a cron job."
                    )
                )
            job.parameters = parameters

        if env_variables is not None:
            if job.schedule is None and job.status != "DRAFT":
                raise ValueError(
                    (
                        "Failed update operation. Cannot update the env variables of "
                        "a job which is not a cron job."
                    )
                )
            job.env_variables = env_variables

        if next_scheduled_time is not None:
            if job.status != "DRAFT":
                raise ValueError(
                    (
                        "Failed update operation. Cannot set the next scheduled "
                        "time of a job which is not a draft."
                    )
                )
            if job.schedule is not None:
                raise ValueError(
                    (
                        "Failed update operation. Cannot set the next scheduled "
                        "time of a cron job."
                    )
                )
            job.next_scheduled_time = datetime.fromisoformat(next_scheduled_time)

        if strategy_json is not None:
            if job.schedule is None and job.status != "DRAFT":
                raise ValueError(
                    (
                        "Failed update operation. Cannot set the strategy json"
                        "of a job which is not a draft nor a cron job."
                    )
                )
            job.strategy_json = strategy_json

        if confirm_draft:
            if job.status != "DRAFT":
                raise ValueError("Failed update operation. The job is not a draft.")

            # Make sure all environments still exist, that is, the
            # pipeline is not referring non-existing environments.
            pipeline_def = job.pipeline_definition
            environment_uuids = set(
                [step["environment"] for step in pipeline_def["steps"].values()]
            )
            env_uuids_missing_image = get_env_uuids_missing_image(
                job.project_uuid, environment_uuids
            )
            if env_uuids_missing_image:
                env_uuids_missing_image = ", ".join(env_uuids_missing_image)
                msg = (
                    "Pipeline references environments that do not exist in the"
                    f" project. The following environments do not exist:"
                    f" [{env_uuids_missing_image}].\n\n Please make sure all"
                    " pipeline steps are assigned an environment that exists"
                    " in the project."
                )
                raise errors.ImageNotFound(msg)

            if job.schedule is None:
                job.status = "PENDING"

                # One time job that needs to run right now. The
                # scheduler will not pick it up because it does not have
                # a next_scheduled_time.
                if job.next_scheduled_time is None:
                    job.last_scheduled_time = datetime.now(timezone.utc)
                    RunJob(self.tpe).transaction(job.uuid)
                else:
                    job.last_scheduled_time = job.next_scheduled_time

                # One time jobs that are set to run at a given date will
                # now be picked up by the scheduler, since they are not
                # a draft anymore.

            # Cron jobs are consired STARTED the moment the scheduler
            # can decide or not about running them.
            else:
                job.last_scheduled_time = job.next_scheduled_time
                job.status = "STARTED"

    def _collateral(self):
        pass


class DeleteJob(TwoPhaseFunction):
    """Delete a job."""

    def _transaction(self, job_uuid):
        self.collateral_kwargs["project_uuid"] = None
        job = models.Job.query.filter_by(uuid=job_uuid).one_or_none()
        if job is None:
            return False
        self.collateral_kwargs["project_uuid"] = job.project_uuid

        # Abort the job, won't do anything if the job is not running.
        AbortJob(self.tpe).transaction(job_uuid)

        # Deletes cascade to: job -> non interactive run
        # non interactive runs -> non interactive run image mapping
        # non interactive runs -> pipeline run step
        db.session.delete(job)
        return True

    def _collateral(self, project_uuid: str):
        if project_uuid is not None:
            process_stale_environment_images(project_uuid)


class UpdateJobPipelineRun(TwoPhaseFunction):
    """Update a pipeline run of a job."""

    def _transaction(self, job_uuid: str, run_uuid: str, status_update: Dict[str, Any]):
        """Set the status of a pipeline run."""
        # Setup for collateral/revert.
        self.collateral_kwargs["project_uuid"] = None
        self.collateral_kwargs["completed"] = False

        filter_by = {
            "job_uuid": job_uuid,
            "uuid": run_uuid,
        }

        update_status_db(
            status_update,
            model=models.NonInteractivePipelineRun,
            filter_by=filter_by,
        )

        # See if the job is done running (all its runs are done).
        if status_update["status"] in ["SUCCESS", "FAILURE"]:

            # The job has 1 run for every parameters set.
            job = (
                db.session.query(
                    models.Job.project_uuid,
                    models.Job.schedule,
                    func.jsonb_array_length(models.Job.parameters),
                )
                .filter_by(uuid=job_uuid)
                .one()
            )
            self.collateral_kwargs["project_uuid"] = job.project_uuid

            # Only non recurring jobs terminate to SUCCESS.
            if job.schedule is None:

                completed_runs = (
                    models.NonInteractivePipelineRun.query.filter_by(job_uuid=job_uuid)
                    .filter(
                        models.NonInteractivePipelineRun.status.in_(
                            ["SUCCESS", "FAILURE"]
                        )
                    )
                    .count()
                )

                current_app.logger.info(
                    (
                        f"Non recurring job {job_uuid} has completed "
                        f"{completed_runs}/{job[2]} runs."
                    )
                )

                if completed_runs == job[2]:
                    models.Job.query.filter_by(uuid=job_uuid).update(
                        {"status": "SUCCESS"}
                    )
                    # The job is completed.
                    self.collateral_kwargs["completed"] = True

        return {"message": "Status was updated successfully"}, 200

    def _collateral(self, project_uuid: str, completed: bool):
        if completed and project_uuid is not None:
            process_stale_environment_images(project_uuid)
