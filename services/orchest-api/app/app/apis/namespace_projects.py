"""API endpoint to manage projects.

Despite the fact that the orchest api has no model related to a 
project, a good amount of other models depend on such a concept.
"""
from flask_restplus import Namespace, Resource

from app.connections import db
from app.apis.namespace_experiments import ExperimentCleanup
from app.apis.namespace_environment_images import ProjectEnvironmentImages
from app.apis.namespace_runs import Run
from app.apis.namespace_sessions import Session
from app.utils import register_schema
import app.models as models

api = Namespace("projects", description="Managing Projects")
api = register_schema(api)


@api.route("/<string:project_uuid>")
@api.param("project_uuid", "UUID of the project")
class Project(Resource):
    @staticmethod
    def cleanup(project_uuid):
        # stop and delete any session if it exists
        sessions = models.InteractiveSession.query.filter_by(
            project_uuid=project_uuid,
        ).all()
        for session in sessions:
            Session.stop(session)

        # any interactive run related to the pipeline is stopped
        # if necessary, then deleted
        interactive_runs = models.InteractiveRun.query.filter_by(
            project_uuid=project_uuid,
        ).all()
        for run in interactive_runs:
            if run.status in ["PENDING", "STARTED"]:
                Run.stop(run.run_uuid)
            # will delete cascade
            # interactive run pipeline step
            # interactive run image mapping
            db.session.delete(run)

        # any experiment related to the pipeline is stopped if necessary
        # , then deleted
        experiments = models.Experiment.query.filter_by(
            project_uuid=project_uuid,
        ).all()
        for experiment in experiments:
            ExperimentCleanup.cleanup(experiment)

        # cleanup images (will also take care of builds and dangling images)
        ProjectEnvironmentImages.cleanup(project_uuid)
        db.session.commit()

    @api.doc("cleanup_project")
    @api.response(200, "Project cleaned up")
    def delete(self, project_uuid):
        """Cleanup a project.

        Any session, run, experiment related to the project is stopped
        and removed from the db. Environment images are removed.
        """
        Project.cleanup(project_uuid)
        return {"message": "Project cleanup was successful"}, 200
