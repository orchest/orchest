"""API endpoint to do validations."""

from typing import Tuple, Optional

import docker
from flask import request
from flask_restplus import Namespace, Resource

from app import schema
from app.connections import docker_client
import app.models as models
from app.utils import register_schema
from _orchest.internals import config as _config


api = Namespace("validations", description="Validates system requirements")
api = register_schema(api)


def validate_environment(project_uuid: str, env_uuid: str) -> Tuple[str, Optional[str]]:
    """Validates whether the environments exist on the system.

    Only passes if all of the conditions below are satisfied:
        * The `project_uuid` and `env_uuid` combination exists in the
          persistent database `EnvironmentBuild` model.
        * There is no "PENDING" or "STARTED" build for the environment.
        * The image: ``_config.ENVIRONMENT_IMAGE_NAME`` exists in the
          docker namespace.

    Args:
        project_uuid
        env_uuid

    Returns:
        (check, action)

        `check` is "pass" or "fail".

        `action` is one of ["BUILD", "WAIT", "RETRY", None]

    """
    # Check the build history for the environment.
    env_builds = models.EnvironmentBuild.query.filter_by(
        project_uuid=project_uuid, environment_uuid=env_uuid
    )
    num_completed_builds = env_builds.count()
    num_building_builds = env_builds.filter(
        models.EnvironmentBuild.status.in_(["PENDING", "STARTED"])
    ).count()

    if not num_completed_builds:
        return "fail", "BUILD"

    if num_building_builds:
        return "fail", "WAIT"

    # Check the docker namespace.
    docker_image_name = _config.ENVIRONMENT_IMAGE_NAME.format(
        project_uuid=project_uuid, environment_uuid=env_uuid
    )
    try:
        docker_client.images.get(docker_image_name)
    except docker.errors.ImageNotFound:
        return "fail", "BUILD"
    except docker.errors.APIError:
        # We cannot determine what happened, so better be safe than
        # sorry.
        return "fail", "RETRY"

    return "pass", None


@api.route("/environments")
class Gate(Resource):
    @api.doc("validate_environments")
    @api.expect(schema.validation_environments)
    @api.marshal_with(
        schema.validation_environments_result,
        code=201,
        description="Validation of environments",
    )
    def post(self):
        """Checks whether the given environments are build and ready.

        NOTE: The order of ``["fail"]`` and ``["action"]`` indicates the
        required action to convert the "fail" to a "pass".

        """
        post_data = request.get_json()
        environment_uuids = post_data["environment_uuids"]
        project_uuid = post_data["project_uuid"]

        res = {
            "validation": None,  # Will be set last
            "fail": [],
            "actions": [],
            "pass": [],
        }
        for env_uuid in environment_uuids:
            # Check will be either "fail" or "pass".
            validation, action = validate_environment(project_uuid, env_uuid)
            res[validation]["environment_uuids"].append(env_uuid)

            if validation == "fail":
                res["actions"].append(action)

        res["validation"] = "fail" if len(res["fail"]) != 0 else "pass"
        return res, 201
