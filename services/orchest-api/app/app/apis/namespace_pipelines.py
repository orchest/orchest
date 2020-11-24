"""API endpoint to manage pipelines.

Despite the fact that the orchest api has no model related to a 
pipeline, a good amount of other models depend on such a concept.
"""
from flask_restplus import Namespace, Resource

from app.connections import db
from app.apis.namespace_sessions import Session
from app.apis.namespace_runs import Run
from app.apis.namespace_experiments import ExperimentCleanup
from app.utils import register_schema
import app.models as models

api = Namespace("pipelines", description="Managing pipelines")
api = register_schema(api)


@api.route("/<string:project_uuid>/<string:pipeline_uuid>")
@api.param("project_uuid", "UUID of the project")
@api.param("pipeline_uuid", "UUID of the pipeline")
class Pipeline(Resource):
    @staticmethod
    def cleanup(project_uuid, pipeline_uuid):
        # stop and delete any session if it exists
        session = models.InteractiveSession.query.filter_by(
            project_uuid=project_uuid, pipeline_uuid=pipeline_uuid
        ).one_or_none()
        if session is not None:
            Session.stop(session)

        # any interactive run related to the pipeline is stopped
        # if necessary, then deleted
        interactive_runs = models.InteractiveRun.query.filter_by(
            project_uuid=project_uuid, pipeline_uuid=pipeline_uuid
        ).all()
        for run in interactive_runs:
            if run.status in ["PENDING", "STARTED"]:
                Run.stop(run.run_uuid)

            # will delete cascade
            # interactive run pipeline step
            # interactive run image mapping
            db.session.delete(run)

        db.session.commit()

    @api.doc("cleanup_pipeline")
    @api.response(200, "Pipeline cleaned up")
    def delete(self, project_uuid, pipeline_uuid):
        """Cleanup a pipeline.

        Any session, run, experiment related to the pipeline is stopped
        and removed from the db.
        """
        Pipeline.cleanup(project_uuid, pipeline_uuid)
        return {"message": "Pipeline cleanup was successful"}, 200
