from datetime import datetime

from flask import current_app, request
from flask_restplus import Namespace, Resource

from app import schema
from app.celery_app import make_celery
from app.connections import db
from app.core.pipelines import construct_pipeline
from app.utils import register_schema, update_status_db
import app.models as models


api = Namespace("experiments", description="Managing experiments")
api = register_schema(api)


@api.route("/")
class ExperimentList(Resource):
    @api.doc("get_experiments")
    @api.marshal_with(schema.experiments)
    def get(self):
        """Fetches all experiments.

        The experiments are either in queue, running or already
        completed.

        """
        experiments = models.Experiment.query.all()
        return {"experiments": [exp.__dict__ for exp in experiments]}, 200

    @api.doc("start_experiment")
    @api.expect(schema.experiment_spec)
    @api.marshal_with(schema.experiment, code=201, description="Queued experiment")
    def post(self):
        """Queues a new experiment."""
        # TODO: possibly use marshal() on the post_data
        # https://flask-restplus.readthedocs.io/en/stable/api.html#flask_restplus.marshal
        #       to make sure the default values etc. are filled in.
        post_data = request.get_json()

        # TODO: maybe we can expect a datetime (in the schema) so we
        #       do not have to parse it here.
        #       https://flask-restplus.readthedocs.io/en/stable/api.html#flask_restplus.fields.DateTime
        scheduled_start = post_data["scheduled_start"]
        scheduled_start = datetime.fromisoformat(scheduled_start)

        pipeline_runs = []
        pipeline_run_spec = post_data["pipeline_run_spec"]
        for pipeline_description, id_ in zip(
            post_data["pipeline_descriptions"], post_data["pipeline_run_ids"]
        ):
            pipeline_run_spec["pipeline_description"] = pipeline_description
            pipeline = construct_pipeline(**post_data["pipeline_run_spec"])

            # TODO: This can be made more efficient, since the pipeline
            #       is the same for all pipeline runs. The only
            #       difference is the parameters. So all the jobs could
            #       be created in batch.
            # Create Celery object with the Flask context and construct the
            # kwargs for the job.
            celery = make_celery(current_app)
            celery_job_kwargs = {
                "experiment_uuid": post_data["experiment_uuid"],
                "project_uuid": post_data["project_uuid"],
                "pipeline_description": pipeline.to_dict(),
                "run_config": pipeline_run_spec["run_config"],
            }

            # Start the run as a background task on Celery. Due to circular
            # imports we send the task by name instead of importing the
            # function directly.
            res = celery.send_task(
                "app.core.tasks.start_non_interactive_pipeline_run",
                eta=scheduled_start,
                kwargs=celery_job_kwargs,
            )

            non_interactive_run = {
                "experiment_uuid": post_data["experiment_uuid"],
                "run_uuid": res.id,
                "pipeline_run_id": id_,
                "pipeline_uuid": pipeline.properties["uuid"],
                "project_uuid": post_data["project_uuid"],
                "status": "PENDING",
            }
            db.session.add(models.NonInteractiveRun(**non_interactive_run))

            # TODO: this code is also in `namespace_runs`. Could
            #       potentially be put in a function for modularity.
            # Set an initial value for the status of the pipline steps that
            # will be run.
            step_uuids = [s.properties["uuid"] for s in pipeline.steps]
            pipeline_steps = []
            for step_uuid in step_uuids:
                pipeline_steps.append(
                    models.NonInteractiveRunPipelineStep(
                        **{
                            "experiment_uuid": post_data["experiment_uuid"],
                            "run_uuid": res.id,
                            "step_uuid": step_uuid,
                            "status": "PENDING",
                        }
                    )
                )
            db.session.bulk_save_objects(pipeline_steps)
            db.session.commit()

            non_interactive_run["pipeline_steps"] = pipeline_steps
            pipeline_runs.append(non_interactive_run)

        experiment = {
            "experiment_uuid": post_data["experiment_uuid"],
            "project_uuid": post_data["project_uuid"],
            "pipeline_uuid": post_data["pipeline_uuid"],
            "scheduled_start": scheduled_start,
            "total_number_of_pipeline_runs": len(pipeline_runs),
        }
        db.session.add(models.Experiment(**experiment))
        db.session.commit()

        experiment["pipeline_runs"] = pipeline_runs
        return experiment, 201


@api.route("/<string:experiment_uuid>")
@api.param("experiment_uuid", "UUID of experiment")
@api.response(404, "Experiment not found")
class Experiment(Resource):
    @api.doc("get_experiment")
    @api.marshal_with(schema.experiment, code=200)
    def get(self, experiment_uuid):
        """Fetches an experiment given its UUID."""
        experiment = models.Experiment.query.get_or_404(
            experiment_uuid, description="Experiment not found",
        )
        return experiment.__dict__

    # TODO: We should also make it possible to stop a particular pipeline
    #       run of an experiment. It should state "cancel" the execution
    #       of a pipeline run, since we do not do termination of running
    #       tasks.
    @api.doc("delete_experiment")
    @api.response(200, "Experiment terminated")
    def delete(self, experiment_uuid):
        """Stops an experiment given its UUID.

        However, it will not delete any corresponding database entries,
        it will update the status of corresponding objects to "REVOKED".
        """
        experiment = models.Experiment.query.get_or_404(
            experiment_uuid, description="Experiment not found",
        )

        run_uuids = [run.run_uuid for run in experiment.pipeline_runs]

        # Revokes all pipeline runs and waits for a reply for 1.0s.
        celery = make_celery(current_app)
        celery.control.revoke(run_uuids, timeout=1.0)

        # Update the status of the run and step entries to "REVOKED".
        models.NonInteractiveRun.query.filter_by(
            experiment_uuid=experiment_uuid
        ).update({"status": "REVOKED"})
        models.NonInteractiveRunPipelineStep.query.filter_by(
            experiment_uuid=experiment_uuid
        ).update({"status": "REVOKED"})
        db.session.commit()

        return {"message": "Experiment termination was successful"}, 200


@api.route(
    "/<string:experiment_uuid>/<string:run_uuid>",
    doc={
        "description": (
            "Set and get execution status of pipeline runs " "in an experiment."
        )
    },
)
@api.param("experiment_uuid", "UUID of Experiment")
@api.param("run_uuid", "UUID of Run")
@api.response(404, "Pipeline run not found")
class PipelineRun(Resource):
    @api.doc("get_pipeline_run")
    @api.marshal_with(schema.non_interactive_run, code=200)
    def get(self, experiment_uuid, run_uuid):
        """Fetch a pipeline run of an experiment given their ids."""
        non_interactive_run = models.NonInteractiveRun.query.get_or_404(
            ident=(experiment_uuid, run_uuid),
            description="Given experiment has no run with given run_uuid",
        )
        return non_interactive_run.__dict__

    @api.doc("set_pipeline_run_status")
    @api.expect(schema.status_update)
    def put(self, experiment_uuid, run_uuid):
        """Set the status of a pipeline run."""
        status_update = request.get_json()

        # The pipeline run has reached a final state, thus we can update
        # the experiment "completed_pipeline_runs" attribute.
        if status_update["status"] in ["SUCCESS", "FAILURE"]:
            experiment = models.Experiment.query.get_or_404(
                experiment_uuid, description="Experiment not found",
            )
            experiment.completed_pipeline_runs += 1
            db.session.commit()

        filter_by = {
            "experiment_uuid": experiment_uuid,
            "run_uuid": run_uuid,
        }
        update_status_db(
            status_update, model=models.NonInteractiveRun, filter_by=filter_by
        )

        return {"message": "Status was updated successfully"}, 200


@api.route(
    "/<string:experiment_uuid>/<string:run_uuid>/<string:step_uuid>",
    doc={
        "description": (
            "Set and get execution status of individual steps of "
            "pipeline runs in an experiment."
        )
    },
)
@api.param("experiment_uuid", "UUID of Experiment")
@api.param("run_uuid", "UUID of Run")
@api.param("step_uuid", "UUID of Step")
@api.response(404, "Pipeline step not found")
class PipelineStepStatus(Resource):
    @api.doc("get_pipeline_run_pipeline_step")
    @api.marshal_with(schema.non_interactive_run, code=200)
    def get(self, experiment_uuid, run_uuid, step_uuid):
        """Fetch a pipeline step of a run of an experiment given uuids."""
        step = models.NonInteractiveRunPipelineStep.query.get_or_404(
            ident=(experiment_uuid, run_uuid, step_uuid),
            description="Combination of given experiment, run and step not found",
        )
        return step.__dict__

    @api.doc("set_pipeline_run_pipeline_step_status")
    @api.expect(schema.status_update)
    def put(self, experiment_uuid, run_uuid, step_uuid):
        """Set the status of a pipeline step of a pipeline run."""
        status_update = request.get_json()

        filter_by = {
            "experiment_uuid": experiment_uuid,
            "run_uuid": run_uuid,
            "step_uuid": step_uuid,
        }
        update_status_db(
            status_update,
            model=models.NonInteractiveRunPipelineStep,
            filter_by=filter_by,
        )

        return {"message": "Status was updated successfully"}, 200
