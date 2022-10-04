"""Namespace to manage snapshots."""
import uuid

from flask import abort, current_app, request
from flask_restx import Namespace, Resource, marshal

import app.models as models
from _orchest.internals.two_phase_executor import TwoPhaseExecutor, TwoPhaseFunction
from app import schema, utils
from app.apis.namespace_jobs import DeleteJob
from app.connections import db

api = Namespace("snapshots", description="Managing snapshots")
api = schema.register_schema(api)


@api.route("")
class SnapshotList(Resource):
    @api.doc("get_snapshots")
    @api.marshal_with(schema.snapshots)
    def get(self):
        """Fetches all snapshots."""

        return {"snapshots": models.Snapshot.query.all()}

    @api.doc("create_snapshot")
    @api.expect(schema.snapshot_spec)
    def post(self):
        """Creates a snapshot entry in the db, doesn't alter the fs."""
        try:
            project_uuid = request.json["project_uuid"]
            pipelines = request.json["pipelines"]

            pipelines_env_vars = {}
            for pipeline_uuid in pipelines:
                pipelines_env_vars[pipeline_uuid] = utils.get_pipeline_env_variables(
                    project_uuid, pipeline_uuid
                )

            snapshot = models.Snapshot(
                uuid=str(uuid.uuid4()),
                project_uuid=project_uuid,
                pipelines=pipelines,
                project_env_variables=utils.get_proj_env_variables(project_uuid),
                pipelines_env_variables=pipelines_env_vars,
            )

            db.session.add(snapshot)
            db.session.commit()
            return marshal(snapshot, schema.snapshot), 201
        except Exception as e:
            current_app.logger.error(e)
            return {"message": str(e)}, 500


@api.route("/<string:snapshot_uuid>")
@api.param("snapshot_uuid", "UUID of the snapshot")
@api.response(404, "Snapshot not found.")
class Snapshot(Resource):
    @api.marshal_with(schema.snapshot, code=200)
    def get(self, snapshot_uuid: str):
        """Fetches a snapshot given its UUID."""
        snapshot = models.Snapshot.query.filter_by(uuid=snapshot_uuid).one_or_none()
        if snapshot is None:
            abort(404, "Snapshot not found.")

        return snapshot

    def delete(self, snapshot_uuid: str):
        """Deletes a snapshot *record* given its UUID."""
        try:
            with TwoPhaseExecutor(db.session) as tpe:
                DeleteSnapshot(tpe).transaction(snapshot_uuid)
            return {"message": "Snapshot deletion was successful."}, 200
        except Exception as e:
            current_app.logger(e)
            return {"message": str(e)}, 500


class DeleteSnapshot(TwoPhaseFunction):
    """Deletes a snapshot record.

    Note that it only deletes the record, it does not delete the
    snapshot from the file system.

    """

    def _transaction(self, snapshot_uuid: str) -> None:
        jobs = (
            models.Job.query.filter_by(
                snapshot_uuid=snapshot_uuid,
            )
            .with_entities(models.Job.uuid)
            .all()
        )
        for job in jobs:
            DeleteJob(self.tpe).transaction(job.uuid)

        snapshot = models.Snapshot.query.get_or_404(
            ident=snapshot_uuid, description="Snapshot not found."
        )
        db.session.delete(snapshot)

    def _collateral(self):
        pass
