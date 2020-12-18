from datetime import datetime
import logging
import uuid

from celery.contrib.abortable import AbortableAsyncResult
from docker import errors
from flask import current_app, request, abort
from flask_restplus import Namespace, Resource

from app import schema
from app.celery_app import make_celery
from app.connections import db
from app.core.pipelines import construct_pipeline
from app.utils import register_schema, update_status_db, lock_environment_images_for_run
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

        experiment = {
            "experiment_uuid": post_data["experiment_uuid"],
            "project_uuid": post_data["project_uuid"],
            "pipeline_uuid": post_data["pipeline_uuid"],
            "scheduled_start": scheduled_start,
            "total_number_of_pipeline_runs": len(post_data["pipeline_definitions"]),
        }
        db.session.add(models.Experiment(**experiment))
        db.session.commit()

        pipeline_runs = []
        pipeline_run_spec = post_data["pipeline_run_spec"]
        env_uuid_docker_id_mappings = None
        # this way we write the entire exp to db, but avoid
        # launching any run (celery task) if we detected a problem
        experiment_creation_error_messages = []
        tasks_to_launch = []

        # TODO: This can be made more efficient, since the pipeline
        #       is the same for all pipeline runs. The only
        #       difference is the parameters. So all the jobs could
        #       be created in batch.
        for pipeline_definition, id_ in zip(
            post_data["pipeline_definitions"], post_data["pipeline_run_ids"]
        ):
            pipeline_run_spec["pipeline_definition"] = pipeline_definition
            pipeline = construct_pipeline(**post_data["pipeline_run_spec"])

            # specify the task_id beforehand to avoid race conditions
            # between the task and its presence in the db
            task_id = str(uuid.uuid4())

            non_interactive_run = {
                "experiment_uuid": post_data["experiment_uuid"],
                "run_uuid": task_id,
                "pipeline_run_id": id_,
                "pipeline_uuid": pipeline.properties["uuid"],
                "project_uuid": post_data["project_uuid"],
                "status": "PENDING",
            }
            db.session.add(models.NonInteractivePipelineRun(**non_interactive_run))
            # need to flush because otherwise the bulk insertion of
            # pipeline steps will lead to foreign key errors
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
            db.session.commit()

            non_interactive_run["pipeline_steps"] = pipeline_steps
            pipeline_runs.append(non_interactive_run)

            # get docker ids of images to use and make it so that the
            # images will not be deleted in case they become
            # outdated by an environment rebuild
            # compute it only once because this way we are guaranteed
            # that the mappings will be the same for all runs, having
            # a new environment build terminate while submitting the
            # different runs won't affect the experiment
            if env_uuid_docker_id_mappings is None:
                try:
                    env_uuid_docker_id_mappings = lock_environment_images_for_run(
                        task_id,
                        post_data["project_uuid"],
                        pipeline.get_environments(),
                    )
                except errors.ImageNotFound as e:
                    experiment_creation_error_messages.append(
                        f"Pipeline was referencing environments for "
                        f"which an image does not exist, {e}"
                    )
            else:
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

            if len(experiment_creation_error_messages) == 0:
                # prepare the args for the task
                run_config = pipeline_run_spec["run_config"]
                run_config["env_uuid_docker_id_mappings"] = env_uuid_docker_id_mappings
                celery_job_kwargs = {
                    "experiment_uuid": post_data["experiment_uuid"],
                    "project_uuid": post_data["project_uuid"],
                    "pipeline_definition": pipeline.to_dict(),
                    "run_config": run_config,
                }

                # Due to circular imports we use the task name instead of
                # importing the function directly.
                tasks_to_launch.append(
                    {
                        "name": "app.core.tasks.start_non_interactive_pipeline_run",
                        "eta": scheduled_start,
                        "kwargs": celery_job_kwargs,
                        "task_id": task_id,
                    }
                )

        experiment["pipeline_runs"] = pipeline_runs

        if len(experiment_creation_error_messages) == 0:
            # Create Celery object with the Flask context
            celery = make_celery(current_app)
            for task in tasks_to_launch:
                res = celery.send_task(**task)
                # NOTE: this is only if a backend is configured.  The task does
                # not return anything. Therefore we can forget its result and
                # make sure that the Celery backend releases recourses (for
                # storing and transmitting results) associated to the task.
                # Uncomment the line below if applicable.
                res.forget()

            return experiment, 201
        else:
            logging.error("\n".join(experiment_creation_error_messages))

            # simple way to update both in memory objects
            # and the db while avoiding multiple update statements
            # (1 for each object)
            for pipeline_run in experiment["pipeline_runs"]:
                pipeline_run.status = "SUCCESS"
                for step in pipeline_run["pipeline_steps"]:
                    step.status = "FAILURE"

                models.PipelineRunStep.query.filter_by(
                    run_uuid=pipeline_run["run_uuid"]
                ).update({"status": "FAILURE"})

            models.NonInteractivePipelineRun.query.filter_by(
                experiment_uuid=post_data["experiment_uuid"]
            ).update({"status": "SUCCESS"})
            db.session.commit()

            return {
                "message": "Failed to create experiment because not all referenced environments are available."
            }, 500


@api.route("/<string:experiment_uuid>")
@api.param("experiment_uuid", "UUID of experiment")
@api.response(404, "Experiment not found")
class Experiment(Resource):
    @api.doc("get_experiment")
    @api.marshal_with(schema.experiment, code=200)
    def get(self, experiment_uuid):
        """Fetches an experiment given its UUID."""
        experiment = models.Experiment.query.get_or_404(
            experiment_uuid,
            description="Experiment not found",
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
        if stop_experiment(experiment_uuid):
            return {"message": "Experiment termination was successful"}, 200
        else:
            return (
                {
                    "message": "Experiment does not \
            exist or is already completed"
                },
                404,
            )


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
        non_interactive_run = models.NonInteractivePipelineRun.query.filter_by(
            run_uuid=run_uuid,
        ).one_or_none()
        if non_interactive_run is None:
            abort(404, "Given experiment has no run with given run_uuid")
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
                experiment_uuid,
                description="Experiment not found",
            )
            experiment.completed_pipeline_runs += 1
            db.session.commit()

        filter_by = {
            "experiment_uuid": experiment_uuid,
            "run_uuid": run_uuid,
        }
        update_status_db(
            status_update, model=models.NonInteractivePipelineRun, filter_by=filter_by
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
        step = models.PipelineRunStep.query.get_or_404(
            ident=(run_uuid, step_uuid),
            description="Combination of given experiment, run and step not found",
        )
        return step.__dict__

    @api.doc("set_pipeline_run_pipeline_step_status")
    @api.expect(schema.status_update)
    def put(self, experiment_uuid, run_uuid, step_uuid):
        """Set the status of a pipeline step of a pipeline run."""
        status_update = request.get_json()

        filter_by = {
            "run_uuid": run_uuid,
            "step_uuid": step_uuid,
        }
        update_status_db(
            status_update,
            model=models.PipelineRunStep,
            filter_by=filter_by,
        )

        return {"message": "Status was updated successfully"}, 200


@api.route("/cleanup/<string:experiment_uuid>")
@api.param("experiment_uuid", "UUID of experiment")
@api.response(404, "Experiment not found")
class ExperimentDeletion(Resource):
    @api.doc("delete_experiment")
    @api.response(200, "Experiment deleted")
    def delete(self, experiment_uuid):
        """Delete an experiment.

        The experiment is stopped if its running, related entities
        are then removed from the db.
        """
        if delete_experiment(experiment_uuid):
            return {"message": "Experiment deletion was successful"}, 200
        else:
            return {"message": "Experiment does not exist"}, 404


def stop_experiment(experiment_uuid) -> bool:
    """Stop an experiment.

    Args:
        experiment_uuid:

    Returns:
        True if the experiment exists and was stopped, false
        if it did not exist or if it was already completed.
    """
    experiment = models.Experiment.query.filter_by(
        experiment_uuid=experiment_uuid
    ).one_or_none()
    if experiment is None:
        return False

    run_uuids = [
        run.run_uuid
        for run in experiment.pipeline_runs
        if run.status in ["PENDING", "STARTED"]
    ]
    if len(run_uuids) == 0:
        return False

    # Aborts and revokes all pipeline runs and waits for a
    # reply for 1.0s.
    celery = make_celery(current_app)
    celery.control.revoke(run_uuids, timeout=1.0)

    # TODO: possibly set status of steps and Run to "ABORTED"
    #  note that a race condition would be present since the task
    # will try to set the status as well
    for run_uuid in run_uuids:
        res = AbortableAsyncResult(run_uuid, app=celery)
        # it is responsibility of the task to terminate by reading \
        # it's aborted status
        res.abort()

        # Update the status of the run and step entries to "REVOKED".
        models.NonInteractivePipelineRun.query.filter_by(run_uuid=run_uuid).update(
            {"status": "REVOKED"}
        )

        models.PipelineRunStep.query.filter_by(run_uuid=run_uuid).update(
            {"status": "REVOKED"}
        )

    db.session.commit()
    return True


def delete_experiment(experiment_uuid) -> bool:
    """Delete an experiment.

    If running, the experiment is aborted. All data related
    to the experiment is removed.

    Args:
        experiment_uuid:

    Returns:
        True if the experiment existed and was removed, false
        otherwise.
    """
    experiment = models.Experiment.query.filter_by(
        experiment_uuid=experiment_uuid
    ).one_or_none()
    if experiment is None:
        return False

    stop_experiment(experiment_uuid)
    # non interactive runs -> non interactive run image mapping
    # non interactive runs step
    db.session.delete(experiment)
    db.session.commit()
    return True
