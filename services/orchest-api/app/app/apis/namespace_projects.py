"""API endpoint to manage projects.

Despite the fact that the orchest api has no model related to a 
project, a good amount of other models depend on such a concept.
"""
from flask_restplus import Namespace, Resource

import app.models as models
from app.apis.namespace_environment_images import delete_project_environment_images
from app.apis.namespace_experiments import delete_experiment
from app.apis.namespace_runs import stop_pipeline_run
from app.apis.namespace_sessions import stop_interactive_session
from app.connections import db
from app.utils import register_schema

api = Namespace("projects", description="Managing Projects")
api = register_schema(api)


@api.route("/<string:project_uuid>")
@api.param("project_uuid", "UUID of the project")
class Project(Resource):
    @api.doc("delete_project")
    @api.response(200, "Project deleted")
    def delete(self, project_uuid):
        """Delete a project.

        Any session, run, experiment related to the project is stopped
        and removed from the db. Environment images are removed.
        """
        delete_project(project_uuid)
        return {"message": "Project deletion was successful"}, 200


def delete_project(project_uuid):
    """Delete a project and all related entities.

    Project sessions, runs and experiments are stopped. Every
    related entity in the db is removed. Environment images are
    deleted up.

    Args:
        project_uuid:
    """

    # any interactive run related to the pipeline is stopped
    # if necessary, then deleted
    interactive_runs = models.InteractivePipelineRun.query.filter_by(
        project_uuid=project_uuid
    ).all()
    for run in interactive_runs:
        if run.status in ["PENDING", "STARTED"]:
            stop_pipeline_run(run.run_uuid)
        # will delete cascade
        # interactive run pipeline step
        # interactive run image mapping
        db.session.delete(run)

    # stop and delete any running session
    sessions = (
        models.InteractiveSession.query.filter_by(
            project_uuid=project_uuid,
        )
        .with_entities(
            models.InteractiveSession.project_uuid,
            models.InteractiveSession.pipeline_uuid,
        )
        .distinct()
        .all()
    )
    for session in sessions:
        # stop and delete any session if it exists
        stop_interactive_session(session.project_uuid, session.pipeline_uuid)

    # any experiment related to the pipeline is stopped if necessary,
    # then deleted
    experiments = (
        models.Experiment.query.filter_by(
            project_uuid=project_uuid,
        )
        .with_entities(models.Experiment.experiment_uuid)
        .all()
    )
    for experiment in experiments:
        delete_experiment(experiment.experiment_uuid)

    # delete images (will also take care of builds and dangling images)
    delete_project_environment_images(project_uuid)
    db.session.commit()
