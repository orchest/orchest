"""API endpoints for unspecified orchest-api level information."""
from flask_restx import Namespace, Resource

from app import models, schema, utils
from app.connections import db

api = Namespace("info", description="Orchest-api information.")
api = utils.register_schema(api)


@api.route("/idle")
class IdleCheck(Resource):
    @api.doc("orchest_api_idle")
    @api.marshal_with(
        schema.idleness_check_result,
        code=200,
        description="Orchest-api idleness check.",
    )
    def get(self):
        """Checks if the Orchest-api is idle.

        The Orchest-api is considered idle if:
        - no environments are being built
        - no jupyter images are being built
        - there are no ongoing interactive-runs
        - there are no ongoing job runs
        - there are no busy kernels among running sessions, said busy
            state is reported by JupyterLab, and reflects the fact that
            a kernel is not actively doing some compute.
        """
        idleness_data = utils.is_orchest_api_idle()
        return idleness_data, 200


@api.route("/client-heartbeat")
class ClientHeartBeat(Resource):
    @api.doc("client_heartbeat")
    def get(self):
        """Allows to signal an heartbeat to the Orchest-api.

        This allows the Orchest-api to know about the fact that some
        clients are using Orchest.

        """
        # Cleanup old entries. Note that this works correctly because
        # we are in transaction mode. If flask would run in eager mode
        # there would be a time window where orchest would be idle, at
        # least according to client heartbeats.
        models.ClientHeartbeat.query.delete()
        db.session.add(models.ClientHeartbeat())
        db.session.commit()

        return "", 200
