from flask import request
from flask.globals import current_app
from flask_restx import Namespace, Resource

import app.models as models
from _orchest.internals import config as _config
from _orchest.internals.two_phase_executor import TwoPhaseExecutor, TwoPhaseFunction
from app import schema
from app.connections import db
from app.core.environment_shells import launch_environment_shell
from app.core.environments import get_env_uuids_to_image_mappings

api = Namespace("environment_shells", description="Manage environment shells")
api = schema.register_schema(api)


@api.route("/")
class SessionList(Resource):
    @api.doc("launch_environment_shell")
    @api.expect(schema.environment_shell_config)
    def post(self):
        """Launches an environment shell."""
        environment_shell_config = request.get_json()

        isess = models.InteractiveSession.query.filter_by(
            project_uuid=environment_shell_config["project_uuid"],
            pipeline_uuid=environment_shell_config["pipeline_uuid"],
        ).one_or_none()
        if isess is None:
            return {"message": "Session doesn't exist."}, 409

        environment_shell_hostname = None
        try:
            with TwoPhaseExecutor(db.session) as tpe:
                environment_shell_hostname = CreateEnvironmentShell(tpe).transaction(
                    environment_shell_config
                )
        except Exception as e:
            current_app.logger.error(e)
            return {"message": str(e)}, 500

        return {
            "environment_shell_hostname": environment_shell_hostname,
            "user": "jovyan",  # Make dynamic?
        }, 201


class CreateEnvironmentShell(TwoPhaseFunction):
    def _transaction(self, environment_shell_config) -> str:
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
            environment_shell_config["project_uuid"],
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
