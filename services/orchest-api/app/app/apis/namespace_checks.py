"""API endpoint to do checks."""

from collections import defaultdict
from itertools import chain
from typing import Any, List, Dict

import docker
from flask import request
from flask_restplus import Namespace, Resource

from app import schema
from app.connections import docker_client
import app.models as models
from app.utils import register_schema
from _orchest.internals import config as _config


api = Namespace("checks", description="Does integrity checks")
api = register_schema(api)


def gate_check_environment(project_uuid: str, env_uuid: str) -> str:
    """Checks the environment gate.

    Only passes if the `project_uuid` and `env_uuid` combination exists
    in the persistent database `EnvironmentBuild` model AND the image:
        ``_config.ENVIRONMENT_IMAGE_NAME``
    exists in the docker namespace.

    Args:
        project_uuid
        env_uuid

    Returns:
        "pass" or "fail". Indicating whether the check was successful
        or not respectively.

    """
    num_builds = models.EnvironmentBuild.query.filter_by(
        project_uuid=project_uuid, environment_uuid=env_uuid
    ).count()

    if not num_builds:
        return "fail"

    docker_image_name = _config.ENVIRONMENT_IMAGE_NAME.format(
        project_uuid=project_uuid, environment_uuid=env_uuid
    )
    try:
        docker_client.get(docker_image_name)
    except docker.errors.ImageNotFound:
        return "fail"
    except docker.errors.APIError:
        # We cannot determine what happened, so better be safe than
        # sorry.
        return "fail"
    else:
        return "pass"


def get_env_uuids(pipe_def: Dict[Any, Any]) -> List[str]:
    env_uuids = []

    # TODO: We need some pipeline class in the internal library so that
    # when the schema changes this code will still be working as it can
    # use a method call instead.
    for step_uuid, step_def in pipe_def["steps"].items():
        env_uuids.append(step_def["environment"])

    return env_uuids


@api.route("/gate/<string:project_uuid>")
@api.param("project_uuid", "UUID of Project")
class Gate(Resource):
    @api.doc("check_gate")
    @api.expect(schema.gate_check)
    @api.marshal_with(schema.gate_check_result, code=201, description="Check started")
    def post(self, project_uuid):
        """Checks the gate.

        Checks whether all the environments are build.

        NOTE: The result is returned in no particular order.

        """
        post_data = request.get_json()

        # Either get the environment UUIDs from the post request
        # directly or get them from the pipeline definitions.
        environment_uuids = post_data.get("environment_uuids", set())

        if post_data["type"] == "deep":
            # Maintain a mapping from environment uuid to pipeline uuid,
            # so we can return in the result what pipelines cannot be
            # run (based on the environments that are not yet build).
            env_to_pipe = defaultdict(list)

            for pipe_def in post_data["pipeline_definitions"]:
                env_uuids = get_env_uuids(pipe_def)
                environment_uuids |= set(env_uuids)

                for env_uuid in env_uuids:
                    env_to_pipe[env_uuid].append(pipe_def["uuid"])

            environment_uuids = list(environment_uuids)

        res = {
            "gate": None,  # Will be set last
            "fail": {"environment_uuids": []},
            "pass": {"environment_uuids": []},
        }
        for env_uuid in environment_uuids:
            # Check will be either "fail" or "pass".
            check = gate_check_environment(project_uuid, env_uuid)
            res[check]["environment_uuids"].append(env_uuid)

        if post_data["type"] == "deep":
            # Get an (flattened) iterable of all failed and passed
            # pipelines.
            failed_pipes = chain(
                env_to_pipe[env_uuid] for env_uuid in res["fail"]["environment_uuids"]
            )
            passed_pipes = chain(
                env_to_pipe[env_uuid] for env_uuid in res["pass"]["environment_uuids"]
            )

            # Populate the `pipeline_uuids` in the result.
            res["fail"]["pipeline_uuids"] = list(set(failed_pipes))
            res["pass"]["pipeline_uuids"] = list(set(passed_pipes))

        res["gate"] = "fail" if len(res["fail"]["environment_uuids"]) != 0 else "pass"
        return res, 201
