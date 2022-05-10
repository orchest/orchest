"""API endpoints for unspecified orchest-api level information."""
from flask import current_app, request
from flask_restx import Namespace, Resource
from orchestcli import cmds

from _orchest.internals import config as _config
from app import schema, utils
from config import CONFIG_CLASS

ns = Namespace("ctl", description="Orchest-api internal control.")
api = utils.register_schema(ns)


@api.route("/start-update")
class StartUpdate(Resource):
    @api.doc("orchest_api_start_update")
    @api.marshal_with(
        schema.update_started_response,
        code=201,
        description="Update Orchest.",
    )
    def post(self):
        try:
            cmds.update(
                version=None,
                controller_deploy_name="orchest-controller",
                controller_pod_label_selector="app=orchest-controller",
                watch_flag=False,
                namespace=_config.ORCHEST_NAMESPACE,
                cluster_name=_config.ORCHEST_CLUSTER,
            )
            return {
                "namespace": _config.ORCHEST_NAMESPACE,
                "cluster_name": _config.ORCHEST_CLUSTER,
            }, 201
        # This is a form of technical debt since we can't distinguish if
        # an update fails because there is no newer version of a "real"
        # failure.
        except SystemExit:
            return {"message": "Failed to update."}, 500


@api.route("/restart")
class Restart(Resource):
    @api.doc("orchest_api_restart")
    @ns.response(code=500, model=schema.dictionary, description="Invalid request")
    def post(self):
        try:
            cmds.restart(
                False,
                namespace=_config.ORCHEST_NAMESPACE,
                cluster_name=_config.ORCHEST_CLUSTER,
            )
            return {}, 201
        except SystemExit:
            return {"message": "Failed to restart."}, 500


@api.route("/orchest-images-to-pre-pull")
class OrchestImagesToPrePull(Resource):
    @api.doc("orchest_images_to_pre_pull")
    def get(self):
        """Orchest images to pre pull on all nodes for a better UX."""
        pre_pull_orchest_images = [
            f"orchest/jupyter-enterprise-gateway:{CONFIG_CLASS.ORCHEST_VERSION}",
            f"orchest/session-sidecar:{CONFIG_CLASS.ORCHEST_VERSION}",
            CONFIG_CLASS.IMAGE_BUILDER_IMAGE,
            utils.get_jupyter_server_image_to_use(),
        ]
        pre_pull_orchest_images = {"pre_pull_images": pre_pull_orchest_images}

        return pre_pull_orchest_images, 200


@api.route("/orchest-settings")
class OrchestSettings(Resource):
    @api.doc("get_orchest_settings")
    def get(self):
        """Get Orchest settings as a json."""
        return utils.OrchestSettings().as_dict(), 200

    @api.doc("update_orchest_settings")
    @api.expect(schema.dictionary)
    @ns.response(code=200, model=schema.settings_update_response, description="Success")
    @ns.response(code=400, model=schema.dictionary, description="Invalid request")
    def put(self):
        """Update Orchest settings through a json.

        Works, essentially, as a dictionary update, it's an upsert.

        Returns the updated configuration. A 400 response with an error
        message is returned if any value is of the wrong type or
        invalid.
        """
        config = utils.OrchestSettings()
        try:
            config.update(request.get_json())
        except (TypeError, ValueError) as e:
            current_app.logger.debug(e, exc_info=True)
            return {"message": f"{e}"}, 400

        requires_restart = config.save(current_app)
        resp = {"requires_restart": requires_restart, "user_config": config.as_dict()}
        return resp, 200

    @api.doc("set_orchest_settings")
    @api.expect(schema.dictionary)
    @ns.response(code=200, model=schema.settings_update_response, description="Success")
    @ns.response(code=400, model=schema.dictionary, description="Invalid request")
    def post(self):
        """Replace Orchest settings through a json.

        Won't allow to remove values which have a defined default value
        and/or that shouldn't be removed.

        Returns the new configuration. A 400 response with an error
        message is returned if any value is of the wrong type or
        invalid.
        """
        config = utils.OrchestSettings()
        try:
            config.set(request.get_json())
        except (TypeError, ValueError) as e:
            current_app.logger.debug(e, exc_info=True)
            return {"message": f"{e}"}, 400

        requires_restart = config.save(current_app)
        resp = {"requires_restart": requires_restart, "user_config": config.as_dict()}
        return resp, 200
