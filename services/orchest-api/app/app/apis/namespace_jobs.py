import uuid
from datetime import datetime
from typing import Any, Dict, List, Tuple

from celery.contrib.abortable import AbortableAsyncResult
from docker import errors
from flask import abort, current_app, request
from flask_restx import Namespace, Resource

import app.models as models
from _orchest.internals.two_phase_executor import TwoPhaseExecutor, TwoPhaseFunction
from app import schema
from app.celery_app import make_celery
from app.connections import db
from app.core.pipelines import Pipeline, construct_pipeline
from app.utils import lock_environment_images_for_run, register_schema, update_status_db

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
        jobs = models.Job.query.all()
        return {"jobs": [exp.__dict__ for exp in jobs]}, 200

    @api.doc("start_job")
    @api.expect(schema.job_spec)
    @api.marshal_with(schema.job, code=201, description="Queued job")
    def post(self):
        """Queues a new job."""
        # TODO: possibly use marshal() on the post_data. Note that we
        # have moved over to using flask_restx
        # https://flask-restx.readthedocs.io/en/stable/api.html#flask_restx.marshal
        #       to make sure the default values etc. are filled in.
        post_data = request.get_json()

        # TODO: maybe we can expect a datetime (in the schema) so we
        #       do not have to parse it here. Again note that we are now
        #       using flask_restx
        # https://flask-restx.readthedocs.io/en/stable/api.html#flask_restx.fields.DateTime
        scheduled_start = post_data["scheduled_start"]
        scheduled_start = datetime.fromisoformat(scheduled_start)

        job = {
            "job_uuid": post_data["job_uuid"],
            "project_uuid": post_data["project_uuid"],
            "pipeline_uuid": post_data["pipeline_uuid"],
            "scheduled_start": scheduled_start,
            "total_number_of_pipeline_runs": len(post_data["pipeline_definitions"]),
        }

        try:
            with TwoPhaseExecutor(db.session) as tpe:
                job = CreateJob(tpe).transaction(
                    job,
                    post_data["pipeline_run_spec"],
                    post_data["pipeline_definitions"],
                    post_data["pipeline_run_ids"],
                )
        except Exception as e:
            return {"message": str(e)}, 500

        return job, 201


@api.route("/<string:job_uuid>")
@api.param("job_uuid", "UUID of job")
@api.response(404, "Job not found")
class Job(Resource):
    @api.doc("get_job")
    @api.marshal_with(schema.job, code=200)
    def get(self, job_uuid):
        """Fetches a job given its UUID."""
        job = models.Job.query.get_or_404(
            job_uuid,
            description="Job not found",
        )
        return job.__dict__

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
        non_interactive_run = models.NonInteractivePipelineRun.query.filter_by(
            run_uuid=run_uuid,
        ).one_or_none()
        if non_interactive_run is None:
            abort(404, "Given job has no run with given run_uuid")
        return non_interactive_run.__dict__

    @api.doc("set_pipeline_run_status")
    @api.expect(schema.status_update)
    def put(self, job_uuid, run_uuid):
        """Set the status of a pipeline run."""
        status_update = request.get_json()

        # The pipeline run has reached a final state, thus we can update
        # the job "completed_pipeline_runs" attribute.
        if status_update["status"] in ["SUCCESS", "FAILURE"]:
            job = models.Job.query.get_or_404(
                job_uuid,
                description="Job not found",
            )
            job.completed_pipeline_runs += 1

        filter_by = {
            "job_uuid": job_uuid,
            "run_uuid": run_uuid,
        }
        try:
            update_status_db(
                status_update,
                model=models.NonInteractivePipelineRun,
                filter_by=filter_by,
            )
            db.session.commit()
        except Exception:
            db.session.rollback()
            return {"message": "Failed update operation."}, 500

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


class CreateJob(TwoPhaseFunction):
    """Create a job."""

    def _transaction(
        self,
        job: Dict[str, Any],
        pipeline_run_spec: Dict[str, Any],
        pipeline_definitions: List[Dict[str, Any]],
        pipeline_run_ids: List[str],
    ):

        db.session.add(models.Job(**job))
        # So that the job can be returned with all runs.
        job["pipeline_runs"] = []
        # To be later used by the collateral effect function.
        tasks_to_launch = []

        for pipeline_definition, id_ in zip(pipeline_definitions, pipeline_run_ids):
            # Note: the pipeline definition contains the parameters of
            # the specific run.
            pipeline_run_spec["pipeline_definition"] = pipeline_definition
            pipeline = construct_pipeline(**pipeline_run_spec)

            # Specify the task_id beforehand to avoid race conditions
            # between the task and its presence in the db.
            task_id = str(uuid.uuid4())
            tasks_to_launch.append((task_id, pipeline))

            non_interactive_run = {
                "job_uuid": job["job_uuid"],
                "run_uuid": task_id,
                "pipeline_run_id": id_,
                "pipeline_uuid": pipeline.properties["uuid"],
                "project_uuid": job["project_uuid"],
                "status": "PENDING",
            }
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

            non_interactive_run["pipeline_steps"] = pipeline_steps
            job["pipeline_runs"].append(non_interactive_run)

        self.collateral_kwargs["job"] = job
        self.collateral_kwargs["tasks_to_launch"] = tasks_to_launch
        self.collateral_kwargs["pipeline_run_spec"] = pipeline_run_spec

        return job

    def _collateral(
        self,
        job: Dict[str, Any],
        pipeline_run_spec: Dict[str, Any],
        tasks_to_launch: Tuple[str, Pipeline],
    ):
        # Safety check in case the job has no runs.
        if not tasks_to_launch:
            return

        # Get docker ids of images to use and make it so that the
        # images will not be deleted in case they become outdate by an
        # an environment rebuild. Compute it only once because this way
        # we are guaranteed that the mappings will be the same for all
        # runs, having a new environment build terminate while
        # submitting the different runs won't affect the job.
        try:
            env_uuid_docker_id_mappings = lock_environment_images_for_run(
                # first (task_id, pipeline) -> task id.
                tasks_to_launch[0][0],
                job["project_uuid"],
                # first (task_id, pipeline) -> pipeline.
                tasks_to_launch[0][1].get_environments(),
            )
        except errors.ImageNotFound as e:
            raise errors.ImageNotFound(
                "Pipeline was referencing environments for "
                f"which an image does not exist, {e}"
            )

        for task_id, _ in tasks_to_launch[1:]:
            image_mappings = [
                models.PipelineRunImageMapping(
                    **{
                        "run_uuid": task_id,
                        "orchest_environment_uuid": env_uuid,
                        "docker_img_id": docker_id,
                    }
                )
                for env_uuid, docker_id in env_uuid_docker_id_mappings.items()
            ]
            db.session.bulk_save_objects(image_mappings)
        db.session.commit()

        # Launch each task through celery.
        celery = make_celery(current_app)
        for task_id, pipeline in tasks_to_launch:
            run_config = pipeline_run_spec["run_config"]
            run_config["env_uuid_docker_id_mappings"] = env_uuid_docker_id_mappings
            celery_job_kwargs = {
                "job_uuid": job["job_uuid"],
                "project_uuid": job["project_uuid"],
                "pipeline_definition": pipeline.to_dict(),
                "run_config": run_config,
            }

            # Due to circular imports we use the task name instead of
            # importing the function directly.
            task_args = {
                "name": "app.core.tasks.start_non_interactive_pipeline_run",
                "eta": job["scheduled_start"],
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
        # Set the status to FAILURE for runs and their steps.
        models.PipelineRunStep.query.filter(
            models.PipelineRunStep.run_uuid.in_(
                self.collateral_kwargs["tasks_to_launch"]
            )
        ).update({"status": "FAILURE"}, synchronize_session=False)

        models.NonInteractivePipelineRun.query.filter(
            models.PipelineRun.run_uuid.in_(self.collateral_kwargs["tasks_to_launch"])
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

        job = models.Job.query.filter_by(job_uuid=job_uuid).one_or_none()
        if job is None:
            return False

        # Store each uuid of runs that can still be aborted. These uuid
        # are the celery task uuid as well.
        for run in job.pipeline_runs:
            if run.status in ["PENDING", "STARTED"]:
                run_uuids.append(run.run_uuid)

        if len(run_uuids) == 0:
            return False

        # Set the state of each run and related steps to ABORTED. Note
        # that the status of steps that have already been completed will
        # not be modified.
        for run_uuid in run_uuids:
            filter_by = {"run_uuid": run_uuid}
            status_update = {"status": "ABORTED"}

            update_status_db(
                status_update,
                model=models.NonInteractivePipelineRun,
                filter_by=filter_by,
            )

            update_status_db(
                status_update, model=models.PipelineRunStep, filter_by=filter_by
            )

        return True

    def _collateral(self, run_uuids: List[str]):
        # Aborts and revokes all pipeline runs and waits for a reply for
        # 1.0s.
        celery = make_celery(current_app)
        celery.control.revoke(run_uuids, timeout=1.0)

        for run_uuid in run_uuids:
            res = AbortableAsyncResult(run_uuid, app=celery)
            # It is responsibility of the task to terminate by reading
            # its aborted status.
            res.abort()

    def _revert(self):
        pass


class DeleteJob(TwoPhaseFunction):
    """Delete a job."""

    def _transaction(self, job_uuid):
        job = models.Job.query.filter_by(job_uuid=job_uuid).one_or_none()
        if job is None:
            return False

        # Abort the job, won't to anything if the job is
        # not running.
        AbortJob(self.tpe).transaction(job_uuid)

        # Deletes cascade to: job -> non interactive run
        # non interactive runs -> non interactive run image mapping
        # non interactive runs -> pipeline run step
        db.session.delete(job)
        return True

    def _collateral(self):
        pass
