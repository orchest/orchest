from typing import Dict, List, Optional, Set

from sqlalchemy import desc, func, tuple_

import app.models as models
from _orchest.internals import config as _config
from app import errors as self_errors
from app import utils
from app.connections import db
from app.core import registry

logger = utils.get_logger()


def get_env_uuids_to_image_mappings(
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
        msg = (
            "Some referenced environments do not exist in the project. The "
            f"following environments do not exist: {envs_missing_image}.\n\n"
            "Please make sure all pipeline steps and services are assigned an "
            "environment that exists in the project."
        )
        raise self_errors.ImageNotFound(msg)

    return env_uuid_to_image


def _lock_environments(project_uuid: str, environment_uuids: Set[str]):
    models.Environment.query.with_for_update().filter(
        models.Environment.uuid.in_(list(environment_uuids)),
        models.Environment.project_uuid == project_uuid,
    ).all()
    models.EnvironmentImage.query.with_for_update().filter(
        models.EnvironmentImage.project_uuid == project_uuid,
        models.EnvironmentImage.environment_uuid.in_(list(environment_uuids)),
        models.EnvironmentImage.marked_for_removal.is_(False),
    ).all()


def lock_environment_images_for_run(
    run_id: str, project_uuid: str, environment_uuids: Set[str]
) -> Dict[str, str]:

    _lock_environments(project_uuid, environment_uuids)
    env_uuid_to_image = get_env_uuids_to_image_mappings(project_uuid, environment_uuids)

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
) -> Dict[str, models.EnvironmentImage]:
    """Locks environment images for an interactive session.

    Won't create an InteractiveSessionInUseImage if the entry exists
    already.
    """
    _lock_environments(project_uuid, environment_uuids)
    env_uuid_to_image = get_env_uuids_to_image_mappings(project_uuid, environment_uuids)

    run_image_mappings = []
    for env_uuid, image in env_uuid_to_image.items():
        if db.session.query(
            db.session.query(models.InteractiveSessionInUseImage)
            .filter(
                models.InteractiveSessionInUseImage.project_uuid == project_uuid,
                models.InteractiveSessionInUseImage.pipeline_uuid == pipeline_uuid,
                models.InteractiveSessionInUseImage.environment_uuid == env_uuid,
                models.InteractiveSessionInUseImage.environment_image_tag == image.tag,
            )
            .exists()
        ).scalar():
            continue

        run_image_mappings.append(
            models.InteractiveSessionInUseImage(
                project_uuid=project_uuid,
                pipeline_uuid=pipeline_uuid,
                environment_uuid=env_uuid,
                environment_image_tag=image.tag,
            )
        )

    db.session.bulk_save_objects(run_image_mappings)
    return env_uuid_to_image


def lock_environment_images_for_job(
    job_uuid: str, project_uuid: str, environment_uuids: Set[str]
) -> Dict[str, str]:
    _lock_environments(project_uuid, environment_uuids)
    env_uuid_to_image = get_env_uuids_to_image_mappings(project_uuid, environment_uuids)

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


def get_active_environment_images() -> List[models.EnvironmentImage]:
    """Gets the list of active environment images (to keep on nodes).

    Assumes that an image that is not marked_for_removal is to be kept
    on nodes, see _env_images_that_can_be_deleted and where
    mark_env_images_that_can_be_removed is called for details.
    """
    return models.EnvironmentImage.query.filter(
        models.EnvironmentImage.marked_for_removal.is_(False)
    ).all()


def _env_images_that_can_be_deleted(
    project_uuid: Optional[str] = None,
    environment_uuid: Optional[str] = None,
    latest_can_be_removed: bool = False,
) -> List[models.EnvironmentImage]:
    """Gets environment images that are not in use and can be deleted.

    An env image to be considered as such needs to respect the following
    requirements:
    - not in use by a session, job or pipeline run
    - not the "latest" image for a given environment, because that would
        mean that a new session, job or pipeline run could use it
    - not already marked_for_removal
    - doesn't share the digest with an image that does not respect point
        1 or 2. This is because the digest is the real "identity" of the
        image, meaning that a name:tag actually points to digest, and
        a digest might be pointed at by different image:tag combinations
        . The registry doesn't allow deletion by image:tag but by
        digest, hence the edge case. Essentially, we don't want to
        delete a digest that is in use.

    Given this, the following query checks for env images which digest
    is not in the digests that are in use or are considered "latest".
    When it comes to edge cases (assuming the query is correct):
    - we don't run the risk of deleting a digest which is in use or
        latest
    - we don't run the risk of deleting a digest right after a new
        "latest" image that uses the same digest has been pushed
        assuming the task performing the registry deletion runs in the
        env builds queue, which ensures that no build is taking place
    - on the nodes, the node-agent is responsible for issuing a
        deletion to the client, said deletion happens by name:tag, which
        avoids the risk of deletion unintended images.
    """
    if latest_can_be_removed and (project_uuid is None or environment_uuid is None):
        raise ValueError(
            "'latest_can_be_removed' requires project and env uuid to be passed."
        )

    # Digests in use.
    imgs_in_use_by_int_runs = (
        db.session.query(models.EnvironmentImage.digest)
        .join(models.PipelineRunInUseImage, models.EnvironmentImage.runs_using_image)
        .join(
            models.InteractivePipelineRun,
            models.InteractivePipelineRun.uuid == models.PipelineRunInUseImage.run_uuid,
        )
        .filter(models.InteractivePipelineRun.status.in_(["PENDING", "STARTED"]))
    )
    imgs_in_use_by_sessions = (
        db.session.query(models.EnvironmentImage.digest)
        .join(
            models.InteractiveSessionInUseImage,
            models.EnvironmentImage.sessions_using_image,
        )
        .join(
            models.InteractiveSession,
            models.InteractiveSession.project_uuid
            == models.InteractiveSessionInUseImage.project_uuid
            and models.InteractiveSessionInUseImage.pipeline_uuid
            == models.InteractiveSessionInUseImage.pipeline_uuid,
        )
    )
    imgs_in_use_by_jobs = (
        db.session.query(models.EnvironmentImage.digest)
        .join(models.JobInUseImage, models.EnvironmentImage.jobs_using_image)
        .join(models.Job, models.Job.uuid == models.JobInUseImage.job_uuid)
        .filter(models.Job.status.in_(["DRAFT", "PENDING", "STARTED", "PAUSED"]))
    )
    imgs_in_use = imgs_in_use_by_int_runs.union(
        imgs_in_use_by_sessions, imgs_in_use_by_jobs
    ).subquery()

    # Latest images digests.
    if not latest_can_be_removed:
        # Will produce a subquery like the following:
        # select project_uuid, environment_uuid, tag,
        # ####
        # rank() OVER (
        #     partition by project_uuid, environment_uuid
        #     order by tag desc
        # ) rank
        # from environment_images
        # order by project_uuid, environment_uuid, tag desc;
        # ####
        # Which will give rank 1 to the "latest" image of every
        # environment, example:
        # project_uuid  | environment_uuid | tag | rank
        # --------------+------------------+-----+------
        # 13006c56-... | 18b59993-...     |   1 |    1
        # 13006c56-... | c56ab762-...     |   2 |    1
        # 13006c56-... | c56ab762-...     |   1 |    2
        # 13006c56-... | e0af758d-...     |   3 |    1
        # 13006c56-... | e0af758d-...     |   2 |    2
        # 13006c56-... | e0af758d-...     |   1 |    3
        tag_rank = (
            func.rank()
            .over(
                partition_by=[
                    models.EnvironmentImage.project_uuid,
                    models.EnvironmentImage.environment_uuid,
                ],
                order_by=models.EnvironmentImage.tag.desc(),
            )
            .label("tag_rank")
        )
        latest_imgs = db.session.query(models.EnvironmentImage).add_column(tag_rank)
        latest_imgs = (
            latest_imgs.from_self()
            .filter(tag_rank == 1)
            .with_entities(models.EnvironmentImage.digest)
            .subquery()
        )

    imgs_not_in_use = models.EnvironmentImage.query.with_for_update().filter(
        models.EnvironmentImage.digest.not_in(imgs_in_use),
        # Assume it's already been processed.
        models.EnvironmentImage.marked_for_removal.is_(False),
    )
    if not latest_can_be_removed:
        imgs_not_in_use = imgs_not_in_use.filter(
            models.EnvironmentImage.digest.not_in(latest_imgs),
        )
    if project_uuid:
        imgs_not_in_use = imgs_not_in_use.filter(
            models.EnvironmentImage.project_uuid == project_uuid
        )
    if environment_uuid:
        imgs_not_in_use = imgs_not_in_use.filter(
            models.EnvironmentImage.environment_uuid == environment_uuid
        )
    return imgs_not_in_use.all()


def mark_all_proj_env_images_to_be_removed_on_env_deletion(
    project_uuid: str, environment_uuid: str
) -> None:
    """Marks all env images of a project to be removed.

    Note: this function does not commit, it's responsibility of the
    caller to do so.

    Helper function that ignores the fact that an image is "latest" when
    deciding if it should be removed. This function only makes sense to
    be called when deleting an environment. If the digest is still in
    use by another image it won't be deleted, but that should not be
    possible in a real world scenario because it would require an env
    image from a different environment to have the exact same digest. If
    that was to happen, the deletion of images would still proceed
    correctly, since:
    - on node deletion is handled declaratively and works by name:tag.
    - registry deletion happens by digest, when the in use image that
        happens to have the same digest won't be in use anymore the
        digest will be deleted, causing the deletion of all tags
        pointing to it.
    """
    _mark_env_images_that_can_be_removed(
        project_uuid=project_uuid,
        environment_uuid=environment_uuid,
        latest_can_be_removed=True,
    )


def mark_env_images_that_can_be_removed(
    project_uuid: Optional[str] = None,
    environment_uuid: Optional[str] = None,
) -> None:
    """Marks env images to be removed.

    The EnvironmentImage.marked_for_removal flag is set to True, said
    images will be deleted from the registry and from nodes.

    Note: this function does not commit, it's responsibility of the
    caller to do so.

    Args:
        project_uuid: if specified, only env image of this project will
            be considered.
        environment_uuid: if specified, only env image of this
            environment will be considered.
    """
    _mark_env_images_that_can_be_removed(
        project_uuid=project_uuid,
        environment_uuid=environment_uuid,
        latest_can_be_removed=False,
    )


def _mark_env_images_that_can_be_removed(
    project_uuid: Optional[str] = None,
    environment_uuid: Optional[str] = None,
    latest_can_be_removed: bool = False,
) -> None:
    """
    Args:
        project_uuid:
        environment_uuid:
        latest_can_be_removed: If True "latest" images for an
            environment will be considerable as removable. This is only
            useful when deleting an environment. Be absolutely sure of
            what you are doing if you set this to True. If this is set
            to True project_uuid and environment_uuid must be passed as
            well.
    """
    logger.info("Marking environment images for removal.")

    # Migrate old env images, will happen only once.
    imgs_to_migrate = models.EnvironmentImage.query.filter(
        models.EnvironmentImage.digest == "Undefined",
    ).all()
    for img in imgs_to_migrate:
        digest = registry.get_manifest_digest(
            _config.ENVIRONMENT_IMAGE_NAME.format(
                project_uuid=img.project_uuid, environment_uuid=img.environment_uuid
            ),
            img.tag,
        )
        if digest is not None:
            img.digest = digest

    imgs = _env_images_that_can_be_deleted(
        project_uuid, environment_uuid, latest_can_be_removed
    )

    # Bulk update "marked_for_removal".
    models.EnvironmentImage.query.filter(
        tuple_(
            models.EnvironmentImage.project_uuid,
            models.EnvironmentImage.environment_uuid,
            models.EnvironmentImage.tag,
        ).in_([(img.project_uuid, img.environment_uuid, img.tag) for img in imgs])
    ).update({"marked_for_removal": True})
