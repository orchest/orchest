"""API endpoint to manage pipelines.

Despite the fact that the orchest api has no model related to a
pipeline, a good amount of other models depend on such a concept.
"""
from flask_restx import Namespace, Resource

import app.models as models
from _orchest.internals.two_phase_executor import TwoPhaseExecutor, TwoPhaseFunction
from app.apis.namespace_runs import AbortPipelineRun
from app.apis.namespace_sessions import StopInteractiveSession
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

        Any session, run, job related to the pipeline is stopped
        and removed from the db.
        """
        try:
            with TwoPhaseExecutor(db.session) as tpe:
                DeletePipeline(tpe).transaction(project_uuid, pipeline_uuid)

        except Exception as e:
            return {"message": str(e)}, 500

        return {"message": "Pipeline deletion was successful."}, 200


class DeletePipeline(TwoPhaseFunction):
    """Delete a pipeline and all related entities.


    Any session or run related to the pipeline is stopped and removed
    from the db.
    """

    def _transaction(self, project_uuid: str, pipeline_uuid: str):
        # Any interactive run related to the pipeline is stopped if
        # necessary, then deleted.
        interactive_runs = (
            models.InteractivePipelineRun.query.filter_by(
                project_uuid=project_uuid, pipeline_uuid=pipeline_uuid
            )
            .filter(models.InteractivePipelineRun.status.in_(["PENDING", "STARTED"]))
            .all()
        )
        for run in interactive_runs:
            AbortPipelineRun(self.tpe).transaction(run.uuid)

            # Will delete cascade: run pipeline step, interactive run
            # image mapping,
            db.session.delete(run)

        # Stop any interactive session related to the pipeline.
        StopInteractiveSession(self.tpe).transaction(project_uuid, pipeline_uuid)

    def _collateral(self):
        pass
