"""API endpoint to manage runs.

Note: "run" is short for "interactive pipeline run".
"""
import uuid
from typing import Any, Dict, Optional

from celery.contrib.abortable import AbortableAsyncResult
from docker import errors
from flask import abort, current_app, request
from flask_restx import Namespace, Resource, marshal
from sqlalchemy import nullslast

import app.models as models
from _orchest.internals.two_phase_executor import TwoPhaseExecutor, TwoPhaseFunction
from app import schema
from app.celery_app import make_celery
from app.connections import db
from app.core.pipelines import Pipeline, construct_pipeline
from app.utils import (
    get_proj_pip_env_variables,
    lock_environment_images_for_run,
    register_schema,
    update_status_db,
)

api = Namespace("runs", description="Manages interactive pipeline runs")
api = register_schema(api)


@api.route("/")
class RunList(Resource):
    @api.doc("get_runs")
    @api.marshal_with(schema.interactive_runs)
    def get(self):
        """Fetches all (interactive) pipeline runs.

        These pipeline runs are either pending, running or have already
        completed. Runs are ordered by started time descending.
        """

        query = models.InteractivePipelineRun.query

        # Ability to query a specific runs given the `pipeline_uuid` or
        # `project_uuid` through the URL (using `request.args`).
        if "pipeline_uuid" in request.args and "project_uuid" in request.args:
            query = query.filter_by(
                pipeline_uuid=request.args.get("pipeline_uuid")
            ).filter_by(project_uuid=request.args.get("project_uuid"))
        elif "project_uuid" in request.args:
            query = query.filter_by(project_uuid=request.args.get("project_uuid"))

        runs = query.order_by(nullslast(models.PipelineRun.started_time.desc())).all()
        return {"runs": [run.__dict__ for run in runs]}, 200

    @api.doc("start_run")
    @api.expect(schema.interactive_run_spec)
    def post(self):
        """Starts a new (interactive) pipeline run."""
        post_data = request.get_json()
        post_data["run_config"]["run_endpoint"] = "runs"

        try:
            with TwoPhaseExecutor(db.session) as tpe:
                run = CreateInteractiveRun(tpe).transaction(
                    post_data["project_uuid"],
                    post_data["run_config"],
                    construct_pipeline(**post_data),
                )
        except Exception as e:
            return {"message": str(e)}, 500

        return marshal(run, schema.interactive_run), 201


@api.route("/<string:run_uuid>")
@api.param("run_uuid", "UUID of Run")
@api.response(404, "Run not found")
class Run(Resource):
    @api.doc("get_run")
    @api.marshal_with(schema.interactive_run, code=200)
    def get(self, run_uuid):
        """Fetches an interactive pipeline run given its UUID."""
        run = models.InteractivePipelineRun.query.filter_by(uuid=run_uuid).one_or_none()
        if run is None:
            abort(404, description="Run not found.")
        return run.__dict__

    @api.doc("set_run_status")
    @api.expect(schema.status_update)
    def put(self, run_uuid):
        """Sets the status of a pipeline run."""

        filter_by = {"uuid": run_uuid}
        status_update = request.get_json()
        try:
            update_status_db(
                status_update, model=models.PipelineRun, filter_by=filter_by
            )
            db.session.commit()
        except Exception:
            db.session.rollback()
            return {"message": "Failed update operation."}, 500

        return {"message": "Status was updated successfully."}, 200

    @api.doc("delete_run")
    @api.response(200, "Run terminated")
    def delete(self, run_uuid):
        """Stops a pipeline run given its UUID."""

        try:
            with TwoPhaseExecutor(db.session) as tpe:
                could_abort = AbortPipelineRun(tpe).transaction(run_uuid)
        except Exception as e:
            return {"message": str(e)}, 500

        if could_abort:
            return {"message": "Run termination was successful."}, 200
        else:
            return {"message": "Run does not exist or is not running."}, 400


@api.route("/<string:run_uuid>/<string:step_uuid>")
@api.param("run_uuid", "UUID of Run")
@api.param("step_uuid", "UUID of Pipeline Step")
@api.response(404, "Pipeline step not found")
class StepStatus(Resource):
    @api.doc("get_step_status")
    @api.marshal_with(schema.pipeline_run_pipeline_step, code=200)
    def get(self, run_uuid, step_uuid):
        """Fetches the status of a pipeline step of a specific run."""
        step = models.PipelineRunStep.query.get_or_404(
            ident=(run_uuid, step_uuid),
            description="Run and step combination not found",
        )
        return step.__dict__

    @api.doc("set_step_status")
    @api.expect(schema.status_update)
    def put(self, run_uuid, step_uuid):
        """Sets the status of a pipeline step."""
        status_update = request.get_json()

        # TODO: first check the status and make sure it says PENDING or
        #       whatever. Because if is empty then this would write it
        #       and then get overwritten afterwards with "PENDING".
        filter_by = {"run_uuid": run_uuid, "step_uuid": step_uuid}
        try:
            update_status_db(
                status_update, model=models.PipelineRunStep, filter_by=filter_by
            )
            db.session.commit()
        except Exception:
            db.session.rollback()
            return {"message": "Failed update operation."}, 500

        return {"message": "Status was updated successfully."}, 200


class AbortPipelineRun(TwoPhaseFunction):
    """Stop a pipeline run.

    Sets its state in the db to ABORTED, revokes the celery task.
    """

    def _transaction(self, run_uuid):
        """Abort a pipeline level at the db level.

        Args:
            run_uuid:

        Returns:
            True if the run state was set to ABORTED, false if the run
            did not exist or was not PENDING/STARTED.
        """

        # If the run is not abortable return false, abortion failed.
        # Set the state and return.
        filter_by = {"uuid": run_uuid}
        status_update = {"status": "ABORTED"}

        # _can_abort is set to True if any row was affected, that is,
        # the run was in a PENDING or STARTED state, since
        # update_status_db won't update it otherwise.
        can_abort = update_status_db(
            status_update, model=models.PipelineRun, filter_by=filter_by
        )
        # Do not attempt to update the status of the steps if the status
        # of the pipeline could not be updated.
        if can_abort:
            filter_by = {"run_uuid": run_uuid}
            update_status_db(
                status_update, model=models.PipelineRunStep, filter_by=filter_by
            )

        self.collateral_kwargs["run_uuid"] = run_uuid if can_abort else None

        return can_abort

    def _collateral(self, run_uuid: Optional[str]):
        """Revoke the pipeline run celery task"""
        # If there run status was not STARTED/PENDING then there is
        # nothing to abort/revoke.
        if not run_uuid:
            return

        celery_app = make_celery(current_app)
        res = AbortableAsyncResult(run_uuid, app=celery_app)
        # It is responsibility of the task to terminate by reading it's
        # aborted status.
        res.abort()
        celery_app.control.revoke(run_uuid)


class CreateInteractiveRun(TwoPhaseFunction):
    def _transaction(
        self,
        project_uuid: str,
        run_config: Dict[str, Any],
        pipeline: Pipeline,
    ):
        # specify the task_id beforehand to avoid race conditions
        # between the task and its presence in the db
        task_id = str(uuid.uuid4())

        # NOTE: we are setting the status of the run ourselves without
        # using the option of celery to get the status of tasks. This
        # way we do not have to configure a backend (where the default
        # of "rpc://" does not give the results we would want).
        run = {
            "uuid": task_id,
            "pipeline_uuid": pipeline.properties["uuid"],
            "project_uuid": project_uuid,
            "status": "PENDING",
        }
        db.session.add(models.InteractivePipelineRun(**run))
        # need to flush because otherwise the bulk insertion of pipeline
        # steps will lead to foreign key errors
        # https://docs.sqlalchemy.org/en/13/orm/persistence_techniques.html#bulk-operations-caveats
        db.session.flush()

        # Set an initial value for the status of the pipeline steps that
        # will be run.
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
        run["pipeline_steps"] = pipeline_steps

        self.collateral_kwargs["project_uuid"] = project_uuid
        self.collateral_kwargs["task_id"] = task_id
        self.collateral_kwargs["pipeline"] = pipeline
        self.collateral_kwargs["run_config"] = run_config
        self.collateral_kwargs["env_variables"] = get_proj_pip_env_variables(
            project_uuid, pipeline.properties["uuid"]
        )
        return run

    def _collateral(
        self,
        project_uuid: str,
        task_id: str,
        pipeline: Pipeline,
        run_config: Dict[str, Any],
        env_variables: Dict[str, Any],
        **kwargs,
    ):
        # Get docker ids of images to use and make it so that the images
        # will not be deleted in case they become outdated by an
        # environment rebuild.
        try:
            env_uuid_docker_id_mappings = lock_environment_images_for_run(
                task_id,
                project_uuid,
                pipeline.get_environments(),
            )
        except errors.ImageNotFound as e:
            msg = (
                "Pipeline references environments that do not exist in the"
                f" project, the following environments do not exist: [{e}].\n\n"
                "Please make sure all pipeline steps are assigned an"
                " environment that exists in the project."
            )
            raise errors.ImageNotFound(msg)

        # Create Celery object with the Flask context and construct the
        # kwargs for the job.
        celery = make_celery(current_app)
        run_config["env_uuid_docker_id_mappings"] = env_uuid_docker_id_mappings
        run_config["user_env_variables"] = env_variables
        # For interactive runs the session uuid is equal to the pipeline
        # uuid.
        run_config["session_uuid"] = pipeline.properties["uuid"]
        run_config["session_type"] = "interactive"
        celery_job_kwargs = {
            "pipeline_definition": pipeline.to_dict(),
            "project_uuid": project_uuid,
            "run_config": run_config,
        }

        # Start the run as a background task on Celery. Due to circular
        # imports we send the task by name instead of importing the
        # function directly.
        res = celery.send_task(
            "app.core.tasks.run_pipeline",
            kwargs=celery_job_kwargs,
            task_id=task_id,
        )

        # NOTE: this is only if a backend is configured.  The task does
        # not return anything. Therefore we can forget its result and
        # make sure that the Celery backend releases recourses (for
        # storing and transmitting results) associated to the task.
        # Uncomment the line below if applicable.
        res.forget()

    def _revert(self):
        models.InteractivePipelineRun.query.filter_by(
            uuid=self.collateral_kwargs["task_id"]
        ).update({"status": "FAILURE"})
        models.PipelineRunStep.query.filter_by(
            run_uuid=self.collateral_kwargs["task_id"]
        ).update({"status": "FAILURE"})
        db.session.commit()
