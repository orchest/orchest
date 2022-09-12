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

from flask import request
from flask.globals import current_app
from flask_restx import Namespace, Resource

import app.models as models
from _orchest.internals import config as _config
from _orchest.internals.two_phase_executor import TwoPhaseExecutor, TwoPhaseFunction
from app import schema
from app.connections import db
from app.core.environment_shells import (
    get_environment_shells,
    launch_environment_shell,
    stop_environment_shell,
)
from app.core.environments import get_env_uuids_to_image_mappings

api = Namespace("environment-shells", description="Manage environment shells")
api = schema.register_schema(api)

@api.route("/<string:session_uuid>")
class EnvironmentShellSessionList(Resource):
    @api.doc("get_environment_shells")
    @api.marshal_with(schema.environment_shells, code=200)
    def get(self, session_uuid):
        """Gets environment shells for a given session_uuid."""
        try:
            environment_shells = get_environment_shells(session_uuid)
            return {"environment_shells": environment_shells}
        except Exception as e:
            return {"message": "%s [%s]" % (e, type(e))}, 500


@api.route("/<string:environment_shell_uuid>")
class EnvironmentShell(Resource):
    @api.doc("delete_environment_shell")
    def delete(self, environment_shell_uuid):
        """Stop environment shell for a given
        session_uuid/environment_shell_uuid."""
        try:
            stop_environment_shell(environment_shell_uuid)
            return {}, 201
        except Exception as e:
            return {"message": "%s [%s]" % (e, type(e))}, 500


@api.route("/")
class EnvironmentShellList(Resource):
    @api.doc("launch_environment_shell")
    @api.expect(schema.environment_shell_config)
    @api.marshal_with(schema.environment_shell, code=200)
    def post(self):
        """Launches an environment shell."""
        environment_shell_config = request.get_json()

        isess = models.InteractiveSession.query.filter_by(
            project_uuid=environment_shell_config["project_uuid"],
            pipeline_uuid=environment_shell_config["pipeline_uuid"],
        ).one_or_none()
        if isess is None:
            return {"message": "Session doesn't exist."}, 409

        environment_shell = None
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

        image_mapping = get_env_uuids_to_image_mappings(
            environment_shell_config["project_uuid"],
            [environment_shell_config["environment_uuid"]],
        )
        environment_image = image_mapping[environment_shell_config["environment_uuid"]]

        environment_image_string = (
            _config.ENVIRONMENT_IMAGE_NAME.format(
                project_uuid=environment_shell_config["project_uuid"],
                environment_uuid=environment_shell_config["environment_uuid"],
            )
            + f":{environment_image.tag}"
        )

        return launch_environment_shell(
            session_uuid,
            environment_shell_config["environment_uuid"],
            environment_shell_config["project_uuid"],
            environment_shell_config["pipeline_uuid"],
            environment_shell_config["pipeline_path"],
            environment_shell_config["userdir_pvc"],
            environment_shell_config["project_dir"],
            environment_image_string,
        )

    def _collateral(
        self,
        *args,
        **kwargs,
    ):
        pass
