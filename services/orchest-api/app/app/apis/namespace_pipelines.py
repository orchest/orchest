"""API endpoint to manage pipelines.

Despite the fact that the orchest api has no model related to a
pipeline, a good amount of other models depend on such a concept.
"""
from flask_restx import Namespace, Resource

import app.models as models
from app.apis.namespace_runs import stop_pipeline_run
from app.apis.namespace_sessions import stop_interactive_session
from app.connections import db
from app.utils import register_schema

api = Namespace("pipelines", description="Managing pipelines")
api = register_schema(api)


@api.route("/<string:project_uuid>/<string:pipeline_uuid>")
@api.param("project_uuid", "UUID of the project")
@api.param("pipeline_uuid", "UUID of the pipeline")
class Pipeline(Resource):
    @api.doc("delete_pipeline")
    @api.response(200, "Pipeline cleaned up")
    def delete(self, project_uuid, pipeline_uuid):
        """Delete a pipeline.

        Any session, run, experiment related to the pipeline is stopped
        and removed from the db.
        """
        delete_pipeline(project_uuid, pipeline_uuid)
        return {"message": "Pipeline deletion was successful"}, 200


def delete_pipeline(project_uuid, pipeline_uuid):
    """Delete a pipeline and all related entities.


    Any session or run related to the pipeline is stopped
    and removed from the db.

    Args:
        project_uuid:
        pipeline_uuid:
    """
    # any interactive run related to the pipeline is stopped
    # if necessary, then deleted
    interactive_runs = models.InteractivePipelineRun.query.filter_by(
        project_uuid=project_uuid, pipeline_uuid=pipeline_uuid
    ).all()
    for run in interactive_runs:
        if run.status in ["PENDING", "STARTED"]:
            stop_pipeline_run(run.run_uuid)

        # will delete cascade
        # interactive run pipeline step
        # interactive run image mapping
        db.session.delete(run)

    # stop and delete any session if it exists
    stop_interactive_session(project_uuid, pipeline_uuid)

    db.session.commit()
