"""API endpoint to manage pipelines.

Despite the fact that the orchest api has no model related to a
pipeline, a good amount of other models depend on such a concept.
"""
from flask import abort, current_app, request
from flask_restx import Namespace, Resource
from sqlalchemy.orm import undefer

import app.models as models
from _orchest.internals import utils as _utils
from _orchest.internals.two_phase_executor import TwoPhaseExecutor, TwoPhaseFunction
from app import schema
from app import types as app_types
from app import utils as app_utils
from app.apis.namespace_runs import AbortPipelineRun
from app.apis.namespace_sessions import StopInteractiveSession
from app.connections import db
from app.core import events

api = Namespace("pipelines", description="Managing pipelines")
api = schema.register_schema(api)


@api.route("/")
class PipelineList(Resource):
    @api.doc("get_pipelines")
    @api.marshal_with(schema.pipelines)
    def get(self):
        """Get all pipelines."""

        pipelines = models.Pipeline.query.all()
        return {"pipelines": [pip.__dict__ for pip in pipelines]}, 200

    @api.doc("create_pipeline")
    @api.expect(schema.pipeline)
    @api.marshal_with(schema.pipeline)
    def post(self):
        """Create a new pipeline."""
        pipeline = request.get_json()
        pipeline["env_variables"] = pipeline.get("env_variables", {})
        if not _utils.are_environment_variables_valid(pipeline["env_variables"]):
            return {"message": ("Invalid environment variables definition.")}, 400

        try:
            db.session.add(models.Pipeline(**pipeline))
            events.register_pipeline_created_event(
                pipeline["project_uuid"],
                pipeline["uuid"],
            )
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(e)
            return {"message": "Pipeline creation failed."}, 500
        return pipeline, 201


@api.route("/<string:project_uuid>/<string:pipeline_uuid>")
@api.param("project_uuid", "uuid of the project")
@api.param("pipeline_uuid", "uuid of the pipeline")
class Pipeline(Resource):
    @api.doc("get_pipeline")
    @api.marshal_with(schema.pipeline, code=200)
    def get(self, project_uuid, pipeline_uuid):
        """Fetches a pipeline given the project and pipeline uuid."""
        pipeline = (
            models.Pipeline.query.options(undefer(models.Pipeline.env_variables))
            .filter_by(project_uuid=project_uuid, uuid=pipeline_uuid)
            .one_or_none()
        )
        if pipeline is None:
            abort(404, "Pipeline not found.")
        return pipeline

    @api.expect(schema.pipeline_update)
    @api.doc("update_pipeline")
    def put(self, project_uuid, pipeline_uuid):
        """Update a pipeline."""
        pipeline = (
            models.Pipeline.query.options(undefer(models.Pipeline.env_variables))
            .filter(
                models.Pipeline.project_uuid == project_uuid,
                models.Pipeline.uuid == pipeline_uuid,
            )
            .one_or_none()
        )
        if pipeline is None:
            abort(404, "Pipeline not found.")

        update = request.get_json()

        # Keep mutable job pipeline name entry up to date so that the
        # job views reflect the newest name.
        if "name" in update:
            if len(update["name"]) > 255:
                return {}, 400
            try:
                models.Job.query.filter_by(
                    project_uuid=project_uuid, pipeline_uuid=pipeline_uuid
                ).update({"pipeline_name": update["name"]})
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                current_app.logger.error(e)
                return {"message": "Failed name update operation."}, 500

        update = models.Pipeline.keep_column_entries(update)
        if not _utils.are_environment_variables_valid(update.get("env_variables", {})):
            return {"message": ("Invalid environment variables definition.")}, 400

        if update:
            try:
                changes = []
                if "env_variables" in update:
                    changes.extend(
                        app_utils.get_env_vars_update(
                            pipeline.env_variables, update["env_variables"]
                        )
                    )
                if "name" in update and pipeline.name != update["name"]:
                    changes.append(
                        app_types.Change(
                            type=app_types.ChangeType.UPDATED, changed_object="name"
                        )
                    )

                models.Pipeline.query.filter_by(
                    project_uuid=project_uuid, uuid=pipeline_uuid
                ).update(update)

                if changes:
                    events.register_pipeline_updated_event(
                        project_uuid,
                        pipeline_uuid,
                        app_types.EntityUpdate(changes=changes),
                    )
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                current_app.logger.error(e)
                return {"message": "Failed update operation."}, 500

        return {"message": "Pipeline was updated successfully."}, 200

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
        StopInteractiveSession(self.tpe).transaction(
            project_uuid, pipeline_uuid, async_mode=True
        )

        models.Pipeline.query.filter_by(
            project_uuid=project_uuid, uuid=pipeline_uuid
        ).update({"env_variables": {}})

        events.register_pipeline_deleted_event(
            project_uuid=project_uuid, pipeline_uuid=pipeline_uuid
        )

        # Note that we do not delete the pipeline from the db since we
        # are not deleting jobs related to the pipeline. Deleting the
        # pipeline would delete cascade jobs.

    def _collateral(self):
        pass
