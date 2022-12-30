"""The environment-shells namespace is used by the
orchest-webserver to start environment shells that
are container backed shell sessions that let users
execute commands in a terminal session that are
based on Orchest Environments created by the user.

The orchest-webserver invokes these endpoints
through the JupyterLab terminal's shellspawner
script.
"""

from typing import Any, Dict
from uuid import uuid4

from flask import request
from flask.globals import current_app
from flask_restx import Namespace, Resource

import app.models as models
from _orchest.internals import config as _config
from _orchest.internals.two_phase_executor import TwoPhaseExecutor, TwoPhaseFunction
from app import schema
from app.connections import db
from app.core import environments
from app.core.environment_shells import (
    get_environment_shells,
    launch_environment_shell,
    stop_environment_shell,
)

api = Namespace("environment-shells", description="Manage environment shells")
api = schema.register_schema(api)


@api.route("/<string:environment_shell_uuid>")
class EnvironmentShell(Resource):
    @api.doc("delete_environment_shell")
    def delete(self, environment_shell_uuid: str):
        """Stop environment shell for a given
        session_uuid/environment_shell_uuid."""
        try:
            stop_environment_shell(environment_shell_uuid)
            return {}, 200
        except Exception as e:
            return {"message": "%s [%s]" % (e, type(e))}, 500


@api.route("/")
class EnvironmentShellList(Resource):
    @api.doc("get_environment_shells")
    @api.param("session_uuid")
    @api.marshal_with(schema.environment_shells, code=200)
    def get(self):
        """Gets environment shells for a given session_uuid."""
        try:
            session_uuid = request.args.get("session_uuid")
            if session_uuid is None:
                return {"message": "session_uuid query argument is required."}, 400

            environment_shells = get_environment_shells(session_uuid)
            return {"environment_shells": environment_shells}
        except Exception as e:
            return {"message": "%s [%s]" % (e, type(e))}, 500

    @api.doc("launch_environment_shell")
    @api.expect(schema.environment_shell_config)
    @api.marshal_with(schema.environment_shell, code=201)
    def post(self):
        """Launches an environment shell."""
        environment_shell_config = request.get_json()

        isess = models.InteractiveSession.query.filter_by(
            project_uuid=environment_shell_config["project_uuid"],
            pipeline_uuid=environment_shell_config["pipeline_uuid"],
        ).one_or_none()
        if isess is None:
            return {"message": "Session doesn't exist."}, 404

        try:
            with TwoPhaseExecutor(db.session) as tpe:
                environment_shell = CreateEnvironmentShell(tpe).transaction(
                    environment_shell_config
                )
        except Exception as e:
            current_app.logger.error(e)
            return {"message": str(e)}, 500

        return environment_shell


class CreateEnvironmentShell(TwoPhaseFunction):
    def _transaction(self, environment_shell_config) -> Dict[str, Any]:
        session_uuid = (
            environment_shell_config["project_uuid"][:18]
            + environment_shell_config["pipeline_uuid"][:18]
        )

        environment_image = (
            environments.lock_environment_images_for_interactive_session(
                environment_shell_config["project_uuid"],
                environment_shell_config["pipeline_uuid"],
                set([environment_shell_config["environment_uuid"]]),
            )[environment_shell_config["environment_uuid"]]
        )

        environment_image_string = (
            _config.ENVIRONMENT_IMAGE_NAME.format(
                project_uuid=environment_shell_config["project_uuid"],
                environment_uuid=environment_shell_config["environment_uuid"],
            )
            + f":{environment_image.tag}"
        )

        # Construct collateral variables
        shell_uuid = "%s-%s" % (
            environment_shell_config["environment_uuid"],
            str(uuid4())[: _config.ENVIRONMENT_SHELL_SUFFIX_UUID_LENGTH],
        )
        service_name = f"environment-shell-{shell_uuid}"

        self.collateral_kwargs["environment_shell_config"] = environment_shell_config
        self.collateral_kwargs["environment_image_string"] = environment_image_string
        self.collateral_kwargs["session_uuid"] = session_uuid
        self.collateral_kwargs["service_name"] = service_name
        self.collateral_kwargs["shell_uuid"] = shell_uuid

        return {
            "hostname": service_name,
            "uuid": shell_uuid,
            "session_uuid": session_uuid,
        }

    def _collateral(
        self,
        environment_shell_config,
        environment_image_string,
        session_uuid,
        service_name,
        shell_uuid,
    ):
        launch_environment_shell(
            session_uuid,
            service_name,
            shell_uuid,
            environment_shell_config["project_uuid"],
            environment_shell_config["pipeline_uuid"],
            environment_shell_config["pipeline_path"],
            environment_shell_config["userdir_pvc"],
            environment_shell_config["project_dir"],
            environment_image_string,
            environment_shell_config.get("auth_user_uuid"),
        )
