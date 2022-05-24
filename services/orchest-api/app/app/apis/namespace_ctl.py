"""API endpoints for unspecified orchest-api level information."""
import os
import subprocess

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
            _run_update_in_venv()
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


def _run_update_in_venv():
    # This function creates a python virtual env and installs
    # orchest_cli within it.
    venv_cmds = """
    rm -rf venv
    python3 -m venv venv && source venv/bin/activate
    pip install orchest-cli
    """

    run_update = """
    python3 -m venv venv && source venv/bin/activate
    orchest update
    """

    env = os.environ.copy()

    def run_cmds(cmds: str, fail_if_std_err):
        """Executes the provided commands.
        Args:
            cmds: commands to execute.
            fail_if_std_err: If True raises SystemExit if stderr if
                not None.

        Raises:
            SystemExit: If `returncode` of the cmds execution is not
                zero or fail_if_std_err is `True` and stderr is non
                None.
        """
        process = subprocess.Popen(
            "/bin/bash",
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            shell=True,
            env=env,
        )

        _, err = process.communicate(cmds.encode("utf-8"))

        if process.returncode != 0 or (fail_if_std_err and err is not None):
            raise SystemExit(1)

    # Create virtual envirement and update
    run_cmds(venv_cmds, False)

    # Run update withing venv
    run_cmds(run_update, True)
