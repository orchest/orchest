from typing import Dict, List, Set

from sqlalchemy import desc

import app.models as models
from _orchest.internals import config as _config
from app import errors as self_errors
from app.connections import db


def get_environment_image_id(name_or_id: str):
    # K8S_TODO: fix this, needs registry.
    return None


def get_env_uuids_missing_image(project_uuid: str, env_uuids: str) -> List[str]:
    env_uuid_to_image = {
        env_uuid: get_environment_image_id(
            _config.ENVIRONMENT_IMAGE_NAME.format(
                project_uuid=project_uuid, environment_uuid=env_uuid
            )
        )
        for env_uuid in env_uuids
    }
    envs_missing_image = [
        env_uuid for env_uuid, image_id in env_uuid_to_image.items() if image_id is None
    ]
    return envs_missing_image


def _get_env_uuids_to_image_mappings(
    project_uuid: str, env_uuids: Set[str]
) -> Dict[str, models.EnvironmentImage]:
    """Map each environment uuid to its latest image entry.

    Args:
        project_uuid: UUID of the project to which the environments
            belong.
        env_uuids: Set of environment uuids.

    Returns:
        Dict[env_uuid] = models.EnvironmentImage

    """
    env_uuid_to_image = {}
    for env_uuid in env_uuids:
        if env_uuid == "":
            raise self_errors.PipelineDefinitionNotValid("Undefined environment.")

        # Note: here we are assuming that the database holds the truth,
        # and that if the record is in the database then the image is in
        # the registry.
        env_image = (
            models.EnvironmentImage.query.filter_by(
                project_uuid=project_uuid,
                environment_uuid=env_uuid,
            )
            .order_by(desc(models.EnvironmentImage.tag))
            .first()
        )
        env_uuid_to_image[env_uuid] = env_image

    envs_missing_image = [
        env_uuid for env_uuid, image in env_uuid_to_image.items() if image is None
    ]
    if len(envs_missing_image) > 0:
        # Reference for later K8S_TODO.
        raise self_errors.ImageNotFound(", ".join(envs_missing_image))

    return env_uuid_to_image


def _lock_environments(project_uuid: str, environment_uuids: Set[str]):
    for env_uuid in environment_uuids:
        models.Environment.query.with_for_update().filter_by(
            project_uuid=project_uuid, uuid=env_uuid
        ).one()


def lock_environment_images_for_run(
    run_id: str, project_uuid: str, environment_uuids: Set[str]
) -> Dict[str, str]:

    _lock_environments(project_uuid, environment_uuids)
    env_uuid_to_image = _get_env_uuids_to_image_mappings(
        project_uuid, environment_uuids
    )

    env_uuid_to_image_name = {}
    run_image_mappings = []
    for env_uuid, image in env_uuid_to_image.items():
        run_image_mappings.append(
            models.PipelineRunInUseImage(
                run_uuid=run_id,
                project_uuid=project_uuid,
                environment_uuid=env_uuid,
                environment_image_tag=image.tag,
            )
        )
        env_uuid_to_image_name[env_uuid] = (
            _config.ENVIRONMENT_IMAGE_NAME.format(
                project_uuid=project_uuid, environment_uuid=env_uuid
            )
            + f":{image.tag}"
        )

    db.session.bulk_save_objects(run_image_mappings)
    return env_uuid_to_image_name


def lock_environment_images_for_interactive_session(
    project_uuid: str, pipeline_uuid: str, environment_uuids: Set[str]
) -> Dict[str, str]:
    """For user services using environment images as a base image."""
    _lock_environments(project_uuid, environment_uuids)
    env_uuid_to_image = _get_env_uuids_to_image_mappings(
        project_uuid, environment_uuids
    )

    env_uuid_to_image_name = {}
    run_image_mappings = []
    for env_uuid, image in env_uuid_to_image.items():
        run_image_mappings.append(
            models.InteractiveSessionInUseImage(
                project_uuid=project_uuid,
                pipeline_uuid=pipeline_uuid,
                environment_uuid=env_uuid,
                environment_image_tag=image.tag,
            )
        )
        env_uuid_to_image_name[env_uuid] = (
            _config.ENVIRONMENT_IMAGE_NAME.format(
                project_uuid=project_uuid, environment_uuid=env_uuid
            )
            + f":{image.tag}"
        )

    db.session.bulk_save_objects(run_image_mappings)
    return env_uuid_to_image_name


def lock_environment_images_for_job(
    job_uuid: str, project_uuid: str, environment_uuids: Set[str]
) -> Dict[str, str]:
    _lock_environments(project_uuid, environment_uuids)
    env_uuid_to_image = _get_env_uuids_to_image_mappings(
        project_uuid, environment_uuids
    )

    env_uuid_to_image_name = {}
    run_image_mappings = []
    for env_uuid, image in env_uuid_to_image.items():
        run_image_mappings.append(
            models.JobInUseImage(
                job_uuid=job_uuid,
                project_uuid=project_uuid,
                environment_uuid=env_uuid,
                environment_image_tag=image.tag,
            )
        )
        env_uuid_to_image_name[env_uuid] = (
            _config.ENVIRONMENT_IMAGE_NAME.format(
                project_uuid=project_uuid, environment_uuid=env_uuid
            )
            + f":{image.tag}"
        )

    db.session.bulk_save_objects(run_image_mappings)
    return env_uuid_to_image_name


def interactive_runs_using_environment(
    project_uuid: str, env_uuid: str
) -> List[models.InteractivePipelineRun]:
    """Get the list of interactive runs using a given environment.

    Args:
        project_uuid:
        env_uuid:

    Returns:
    """
    return models.InteractivePipelineRun.query.filter(
        models.InteractivePipelineRun.project_uuid == project_uuid,
        models.InteractivePipelineRun.images_in_use.any(environment_uuid=env_uuid),
        models.InteractivePipelineRun.status.in_(["PENDING", "STARTED"]),
    ).all()


def interactive_sessions_using_environment(
    project_uuid: str, env_uuid: str
) -> List[models.InteractiveSession]:
    """Get the list of interactive sessions using a given environment.

    Args:
        project_uuid:
        env_uuid:

    Returns:
    """
    return models.InteractiveSession.query.filter(
        models.InteractiveSession.project_uuid == project_uuid,
        models.InteractiveSession.images_in_use.any(environment_uuid=env_uuid),
    ).all()


def jobs_using_environment(project_uuid: str, env_uuid: str) -> List[models.Job]:
    """Get the list of jobs using a given environment.

    Args:
        project_uuid:
        env_uuid:

    Returns:
    """

    return models.Job.query.filter(
        models.Job.project_uuid == project_uuid,
        models.Job.images_in_use.any(environment_uuid=env_uuid),
        models.Job.status.in_(["DRAFT", "PENDING", "STARTED", "PAUSED"]),
    ).all()


def is_environment_in_use(project_uuid: str, env_uuid: str) -> bool:
    """True if the environment is or will be in use by a run/job

    Args:
        env_uuid:

    Returns:
        bool:
    """

    return (
        len(interactive_sessions_using_environment(project_uuid, env_uuid)) > 0
        or len(interactive_runs_using_environment(project_uuid, env_uuid)) > 0
        or len(jobs_using_environment(project_uuid, env_uuid)) > 0
    )
