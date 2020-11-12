"""API endpoint to manage runs.

Note: "run" is short for "interactive pipeline run".
"""
from celery.task.control import revoke
from celery.contrib.abortable import AbortableAsyncResult
from flask import current_app, request
from flask_restplus import Namespace, Resource

from app import schema
from app.celery_app import make_celery
from app.connections import db
from app.core.pipelines import construct_pipeline
from app.utils import register_schema, update_status_db
import app.models as models


api = Namespace("runs", description="Manages interactive pipeline runs")
api = register_schema(api)


@api.route("/")
class RunList(Resource):
    @api.doc("get_runs")
    @api.marshal_with(schema.interactive_runs)
    def get(self):
        """Fetches all (interactive) pipeline runs.

        These pipeline runs are either pending, running or have already
        completed.
        """

        query = models.InteractiveRun.query

        # Ability to query a specific runs given the `pipeline_uuid` or `project_uuid`
        # through the URL (using `request.args`).
        if "pipeline_uuid" in request.args and "project_uuid" in request.args:
            query = query.filter_by(
                pipeline_uuid=request.args.get("pipeline_uuid")
            ).filter_by(project_uuid=request.args.get("project_uuid"))
        elif "project_uuid" in request.args:
            query = query.filter_by(project_uuid=request.args.get("project_uuid"))

        runs = query.all()
        return {"runs": [run.as_dict() for run in runs]}, 200

    @api.doc("start_run")
    @api.expect(schema.interactive_run_spec)
    @api.marshal_with(schema.interactive_run, code=201, description="Run started")
    def post(self):
        """Starts a new (interactive) pipeline run."""
        post_data = request.get_json()
        post_data["run_config"]["run_endpoint"] = "runs"

        pipeline = construct_pipeline(**post_data)

        # Create Celery object with the Flask context and construct the
        # kwargs for the job.
        celery = make_celery(current_app)
        celery_job_kwargs = {
            "pipeline_description": pipeline.to_dict(),
            "project_uuid": post_data["project_uuid"],
            "run_config": post_data["run_config"],
        }

        # Start the run as a background task on Celery. Due to circular
        # imports we send the task by name instead of importing the
        # function directly.
        res = celery.send_task("app.core.tasks.run_pipeline", kwargs=celery_job_kwargs)

        # NOTE: this is only if a backend is configured.  The task does
        # not return anything. Therefore we can forget its result and
        # make sure that the Celery backend releases recourses (for
        # storing and transmitting results) associated to the task.
        # Uncomment the line below if applicable.
        res.forget()

        # NOTE: we are setting the status of the run ourselves without
        # using the option of celery to get the status of tasks. This
        # way we do not have to configure a backend (where the default
        # of "rpc://" does not give the results we would want).
        run = {
            "run_uuid": res.id,
            "pipeline_uuid": pipeline.properties["uuid"],
            "project_uuid": post_data["project_uuid"],
            "status": "PENDING",
        }
        db.session.add(models.InteractiveRun(**run))

        # Set an initial value for the status of the pipline steps that
        # will be run.
        step_uuids = [s.properties["uuid"] for s in pipeline.steps]

        pipeline_steps = []
        for step_uuid in step_uuids:
            pipeline_steps.append(
                models.InteractiveRunPipelineStep(
                    **{"run_uuid": res.id, "step_uuid": step_uuid, "status": "PENDING"}
                )
            )
        db.session.bulk_save_objects(pipeline_steps)
        db.session.commit()

        run["pipeline_steps"] = pipeline_steps
        return run, 201


@api.route("/<string:run_uuid>")
@api.param("run_uuid", "UUID of Run")
@api.response(404, "Run not found")
class Run(Resource):
    @api.doc("get_run")
    @api.marshal_with(schema.interactive_run, code=200)
    def get(self, run_uuid):
        """Fetches a pipeline run given its UUID."""
        run = models.InteractiveRun.query.get_or_404(
            run_uuid, description="Run not found"
        )
        return run.__dict__

    @api.doc("set_run_status")
    @api.expect(schema.status_update)
    def put(self, run_uuid):
        """Sets the status of a pipeline run."""
        post_data = request.get_json()

        res = models.InteractiveRun.query.filter_by(run_uuid=run_uuid).update(
            {"status": post_data["status"]}
        )

        if res:
            db.session.commit()

        return {"message": "Status was updated successfully"}, 200

    @api.doc("delete_run")
    @api.response(200, "Run terminated")
    def delete(self, run_uuid):
        """Stops a pipeline run given its UUID."""

        celery_app = make_celery(current_app)
        res = AbortableAsyncResult(run_uuid, app=celery_app)

        # it is responsibility of the task to terminate by reading it's aborted status
        res.abort()

        # TODO: possibly set status of steps and Run to "ABORTED"

        return {"message": "Run termination was successful"}, 200


@api.route("/<string:run_uuid>/<string:step_uuid>")
@api.param("run_uuid", "UUID of Run")
@api.param("step_uuid", "UUID of Pipeline Step")
@api.response(404, "Pipeline step not found")
class StepStatus(Resource):
    @api.doc("get_step_status")
    @api.marshal_with(schema.pipeline_run_pipeline_step, code=200)
    def get(self, run_uuid, step_uuid):
        """Fetches the status of a pipeline step of a specific run."""
        step = models.InteractiveRunPipelineStep.query.get_or_404(
            ident=(run_uuid, step_uuid),
            description="Run and step combination not found",
        )
        return step.__dict__

    @api.doc("set_step_status")
    @api.expect(schema.status_update)
    def put(self, run_uuid, step_uuid):
        """Sets the status of a pipeline step."""
        status_update = request.get_json()

        # TODO: don't we want to do this async? Since otherwise the API
        #       call might be blocking another since they both execute
        #       on the database? SQLite can only have one process write
        #       to the db. If this becomes an issue than we could also
        #       use an in-memory db (since that is a lot faster than
        #       disk). Otherwise we might have to use PostgreSQL.
        # TODO: first check the status and make sure it says PENDING or
        #       whatever. Because if is empty then this would write it
        #       and then get overwritten afterwards with "PENDING".
        filter_by = {"run_uuid": run_uuid, "step_uuid": step_uuid}
        update_status_db(
            status_update, model=models.InteractiveRunPipelineStep, filter_by=filter_by
        )

        return {"message": "Status was updated successfully"}, 200
