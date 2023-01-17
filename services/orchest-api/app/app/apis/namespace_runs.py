"""API endpoint to manage runs.

Note: "run" is short for "interactive pipeline run".
"""
import uuid
from typing import Any, Dict, Optional

from celery.contrib.abortable import AbortableAsyncResult
from flask import abort, current_app, request
from flask_restx import Namespace, Resource, marshal
from sqlalchemy import nullslast

import app.models as models
from _orchest.internals.two_phase_executor import TwoPhaseExecutor, TwoPhaseFunction
from app import errors as self_errors
from app import schema
from app.connections import db
from app.core import environments, events
from app.core.pipelines import Pipeline, construct_pipeline
from app.utils import get_proj_pip_env_variables, update_status_db

api = Namespace("runs", description="Manages interactive pipeline runs")
api = schema.register_schema(api)


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
        elif request.args["active"] == "true":
            active_states = ["STARTED", "PENDING"]
            expression = models.InteractivePipelineRun.status.in_(active_states)
            query = query.filter(expression)

        runs = query.order_by(nullslast(models.PipelineRun.started_time.desc())).all()
        return {"runs": [run.__dict__ for run in runs]}, 200

    @api.doc("start_run")
    @api.expect(schema.interactive_run_spec)
    def post(self):
        """Starts a new (interactive) pipeline run."""
        post_data = request.get_json()

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

    @api.doc("delete_run")
    @api.response(200, "Run terminated")
    def delete(self, run_uuid):
        """Stops a pipeline run given its UUID."""

        try:
            with TwoPhaseExecutor(db.session) as tpe:
                could_abort = AbortInteractivePipelineRun(tpe).transaction(run_uuid)
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

        celery = current_app.config["CELERY"]
        res = AbortableAsyncResult(run_uuid, app=celery)
        # It is responsibility of the task to terminate by reading it's
        # aborted status.
        res.abort()
        celery.control.revoke(run_uuid)


class AbortInteractivePipelineRun(TwoPhaseFunction):
    """Aborts an interactive pipeline run."""

    def _transaction(self, run_uuid):
        could_abort = AbortPipelineRun(self.tpe).transaction(run_uuid)
        if not could_abort:
            return False

        run = models.PipelineRun.query.filter(models.PipelineRun.uuid == run_uuid).one()
        events.register_interactive_pipeline_run_cancelled(
            run.project_uuid, run.pipeline_uuid, run_uuid
        )
        return True

    def _collateral(self):
        pass


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
            "pipeline_definition": pipeline.to_dict(),
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

        try:
            env_uuid_to_image = environments.lock_environment_images_for_run(
                task_id,
                project_uuid,
                pipeline.get_environments(),
            )
        except self_errors.PipelineDefinitionNotValid:
            msg = "Please make sure every pipeline step is assigned an environment."
            raise self_errors.PipelineDefinitionNotValid(msg)

        events.register_interactive_pipeline_run_created(
            project_uuid, pipeline.properties["uuid"], task_id
        )

        self.collateral_kwargs["project_uuid"] = project_uuid
        self.collateral_kwargs["task_id"] = task_id
        self.collateral_kwargs["pipeline"] = pipeline
        self.collateral_kwargs["run_config"] = run_config
        self.collateral_kwargs["env_variables"] = get_proj_pip_env_variables(
            project_uuid, pipeline.properties["uuid"]
        )
        self.collateral_kwargs["env_uuid_to_image"] = env_uuid_to_image
        return run

    def _collateral(
        self,
        project_uuid: str,
        task_id: str,
        pipeline: Pipeline,
        run_config: Dict[str, Any],
        env_variables: Dict[str, Any],
        env_uuid_to_image: Dict[str, str],
        **kwargs,
    ):

        # Create Celery object with the Flask context and construct the
        # kwargs for the job.
        celery = current_app.config["CELERY"]
        run_config["env_uuid_to_image"] = env_uuid_to_image
        run_config["user_env_variables"] = env_variables
        run_config["session_uuid"] = (
            project_uuid[:18] + pipeline.properties["uuid"][:18]
        )
        run_config["session_type"] = "interactive"
        celery_job_kwargs = {
            "pipeline_definition": pipeline.to_dict(),
            "run_config": run_config,
            "session_uuid": run_config["session_uuid"],
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
        events.register_interactive_pipeline_run_failed(
            self.collateral_kwargs["project_uuid"],
            self.collateral_kwargs["pipeline"].properties["uuid"],
            self.collateral_kwargs["task_id"],
        )
        db.session.commit()


class UpdateInteractivePipelineRun(TwoPhaseFunction):
    """Updates an interactive pipeline run."""

    def _transaction(self, run_uuid: str, status: str):
        filter_by = {"uuid": run_uuid}
        status_update = {"status": status}
        has_updated = update_status_db(
            status_update, model=models.PipelineRun, filter_by=filter_by
        )
        if has_updated:
            run = models.InteractivePipelineRun.query.filter(
                models.InteractivePipelineRun.uuid == run_uuid
            ).one()
            if status_update["status"] == "STARTED":
                events.register_interactive_pipeline_run_started(
                    run.project_uuid, run.pipeline_uuid, run_uuid
                )
            elif status_update["status"] == "FAILURE":
                events.register_interactive_pipeline_run_failed(
                    run.project_uuid, run.pipeline_uuid, run_uuid
                )
            elif status_update["status"] == "SUCCESS":
                events.register_interactive_pipeline_run_succeeded(
                    run.project_uuid, run.pipeline_uuid, run_uuid
                )

    def _collateral(self):
        pass
