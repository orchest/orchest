from typing import Dict, List, Set

import app.models as models
from _orchest.internals import config as _config
from app import errors as self_errors
from app.connections import db


def get_environment_image_id(name_or_id: str):
    # K8S_TODO: fix this, needs registry.
    return None


def get_env_uuids_missing_image(project_uuid: str, env_uuids: str) -> List[str]:
    env_uuid_image_id_mappings = {
        env_uuid: get_environment_image_id(
            _config.ENVIRONMENT_IMAGE_NAME.format(
                project_uuid=project_uuid, environment_uuid=env_uuid
            )
        )
        for env_uuid in env_uuids
    }
    envs_missing_image = [
        env_uuid
        for env_uuid, image_id in env_uuid_image_id_mappings.items()
        if image_id is None
    ]
    return envs_missing_image


def get_env_uuids_to_image_id_mappings(
    project_uuid: str, env_uuids: Set[str]
) -> Dict[str, str]:
    """Map each environment uuid to its current image id.

    Args:
        project_uuid: UUID of the project to which the environments
         belong
        env_uuids: Set of environment uuids.

    Returns:
        Dict[env_uuid] = image_id

    """
    env_uuid_image_id_mappings = {}
    for env_uuid in env_uuids:
        if env_uuid == "":
            raise self_errors.PipelineDefinitionNotValid("Undefined environment.")

        # K8S_TODO: fix.
        env_uuid_image_id_mappings[env_uuid] = _config.ENVIRONMENT_IMAGE_NAME.format(
            project_uuid=project_uuid, environment_uuid=env_uuid
        )

    envs_missing_image = [
        env_uuid
        for env_uuid, image_id in env_uuid_image_id_mappings.items()
        if image_id is None
    ]
    if len(envs_missing_image) > 0:
        # Reference for later K8S_TODO.
        raise self_errors.ImageNotFound(", ".join(envs_missing_image))

    return env_uuid_image_id_mappings


def lock_environment_images_for_run(
    run_id: str, project_uuid: str, environment_uuids: Set[str]
) -> Dict[str, str]:
    return {}


def lock_environment_images_for_session(
    project_uuid: str, pipeline_uuid: str, environment_uuids: Set[str]
) -> Dict[str, str]:
    return {}


def lock_environment_images_for_job(
    job_uuid: str, project_uuid: str, environment_uuids: Set[str]
) -> Dict[str, str]:
    return {}


def interactive_runs_using_environment(project_uuid: str, env_uuid: str):
    return []


def interactive_sessions_using_environment(project_uuid: str, env_uuid: str):
    return []


def jobs_using_environment(project_uuid: str, env_uuid: str):
    return []


def is_environment_in_use(project_uuid: str, env_uuid: str) -> bool:
    """True if the environment is or will be in use by a run/job

    Args:
        env_uuid:

    Returns:
        bool:
    """

    int_sess = interactive_sessions_using_environment(project_uuid, env_uuid)
    int_runs = interactive_runs_using_environment(project_uuid, env_uuid)
    jobs = jobs_using_environment(project_uuid, env_uuid)
    return len(int_runs) > 0 or len(int_sess) > 0 or len(jobs) > 0
