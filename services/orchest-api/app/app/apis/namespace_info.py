"""API endpoints for unspecified orchest-api level information."""

from flask_restx import Namespace, Resource

from app import schema, utils

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
