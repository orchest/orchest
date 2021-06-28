import logging
import time
from datetime import datetime
from typing import Dict, List, Optional, Set

import requests
from celery.utils.log import get_task_logger
from docker import errors
from flask import current_app
from flask_restx import Model, Namespace
from sqlalchemy.orm import undefer

import app.models as models
from _orchest.internals import config as _config
from _orchest.internals.utils import docker_images_list_safe, docker_images_rm_safe
from app import schema
from app.connections import db, docker_client


def register_schema(api: Namespace) -> Namespace:
    all_models = [
        getattr(schema, attr)
        for attr in dir(schema)
        if isinstance(getattr(schema, attr), Model)
    ]

    # TODO: only a subset of all models should be registered.
    for model in all_models:
        api.add_model(model.name, model)

    return api


def shutdown_jupyter_server(url: str) -> bool:
    """Shuts down the Jupyter server via an authenticated POST request.

    Sends an authenticated DELETE request to:
        "url"/api/kernels/<kernel.id>
    for every running kernel. And then shuts down the Jupyter server
    itself via an authenticated POST request to:
        "url"/api/shutdown

    Args:
        connection_file: path to the connection_file that contains the
            server information needed to connect to the Jupyter server.
        url: the url at which the Jupyter server is running.

    Returns:
        False if no Jupyter server is running. True otherwise.
    """

    current_app.logger.info("Shutting down Jupyter Server at url: %s" % url)

    # Shutdown the server, such that it also shuts down all related
    # kernels.
    # NOTE: Do not use /api/shutdown to gracefully shut down all kernels
    # as it is non-blocking, causing container based kernels to persist!
    r = requests.get(f"{url}api/kernels")

    kernels_json = r.json()

    # In case there are connection issue with the Gateway, then the
    # "kernels_json" will be a dictionary:
    # {'message': "Connection refused from Gateway server url, ...}
    # Thus we first check whether we can indeed start shutting down
    # kernels.
    if isinstance(kernels_json, list):
        for kernel in kernels_json:
            requests.delete(f'{url}api/kernels/{kernel.get("id")}')

    # Now that all kernels all shut down, also shut down the Jupyter
    # server itself.
    r = requests.post(f"{url}api/shutdown")

    return True


def update_status_db(
    status_update: Dict[str, str], model: Model, filter_by: Dict[str, str]
) -> None:
    """Updates the status attribute of particular entry in the database.

    An entity that has already reached an end state, i.e. FAILURE,
    SUCCESS, ABORTED, will not be updated. This is to avoid race
    conditions.

    Args:
        status_update: The new status {'status': 'STARTED'}.
        model: Database model to update the status of. Assumed to have a
            status column mapping to a string.
        filter_by: The filter to query the exact resource for which to
            update its status.

    Returns:
        True if at least 1 row was updated, false otherwise.

    """
    data = status_update

    if data["status"] == "STARTED":
        data["started_time"] = datetime.fromisoformat(data["started_time"])
    elif data["status"] in ["SUCCESS", "FAILURE"]:
        data["finished_time"] = datetime.fromisoformat(data["finished_time"])

    res = (
        model.query.filter_by(**filter_by)
        .filter(
            # This implies that an entity cannot be furtherly updated
            # once it reaches an "end state", i.e. FAILURE, SUCCESS,
            # ABORTED. This helps avoiding race conditions given by the
            # orchest-api and a celery task trying to update the same
            # entity concurrently, for example when a task is aborted.
            model.status.in_(["PENDING", "STARTED"])
        )
        .update(
            data,
            # https://docs.sqlalchemy.org/en/14/orm/session_basics.html#orm-expression-update-delete
            # The default "evaluate" is not reliable, because depending
            # on the complexity of the model sqlalchemy might not have a
            # working implementation, in that case it will raise an
            # exception. From the docs:
            # For UPDATE or DELETE statements with complex criteria, the
            # 'evaluate' strategy may not be able to evaluate the
            # expression in Python and will raise an error.
            synchronize_session="fetch",
        )
    )

    return bool(res)


def get_environment_image_docker_id(name_or_id: str):
    try:
        return docker_client.images.get(name_or_id).id
    except errors.ImageNotFound:
        return None


def get_env_uuids_missing_image(project_uuid: str, env_uuids: str) -> List[str]:
    env_uuid_docker_id_mappings = {
        env_uuid: get_environment_image_docker_id(
            _config.ENVIRONMENT_IMAGE_NAME.format(
                project_uuid=project_uuid, environment_uuid=env_uuid
            )
        )
        for env_uuid in env_uuids
    }
    envs_missing_image = [
        env_uuid
        for env_uuid, docker_id in env_uuid_docker_id_mappings.items()
        if docker_id is None
    ]
    return envs_missing_image


def get_env_uuids_to_docker_id_mappings(
    project_uuid: str, env_uuids: Set[str]
) -> Dict[str, str]:
    """Map each environment uuid to its current image docker id.

    Args:
        project_uuid: UUID of the project to which the environments
         belong
        env_uuids: Set of environment uuids.

    Returns:
        Dict[env_uuid] = docker_id

    """
    env_uuid_docker_id_mappings = {
        env_uuid: get_environment_image_docker_id(
            _config.ENVIRONMENT_IMAGE_NAME.format(
                project_uuid=project_uuid, environment_uuid=env_uuid
            )
        )
        for env_uuid in env_uuids
    }
    envs_missing_image = [
        env_uuid
        for env_uuid, docker_id in env_uuid_docker_id_mappings.items()
        if docker_id is None
    ]
    if len(envs_missing_image) > 0:
        raise errors.ImageNotFound(", ".join(envs_missing_image))
    return env_uuid_docker_id_mappings


def lock_environment_images_for_run(
    run_id: str, project_uuid: str, environment_uuids: Set[str]
) -> Dict[str, str]:
    """Retrieve the docker ids to use for a pipeline run.

    Locks a set of environment images by making it so that they will
    not be deleted by the attempt cleanup that follows an environment
    build.

    This is done by adding some entries to the db that will signal the
    fact that the image will be used by a run, as long as the run is
    PENDING or STARTED.

    In order to avoid a race condition that happens between reading the
    docker ids of the used environment and actually writing to db, some
    logic needs to take place, such logic constitutes the bulk of this
    function.

    As a collateral effect, new entries for interactive or non
    interactive image mappings will be added, which is at the same time
    the mechanism through which we "lock" the images, or, protect them
    from deletion as long as they are needed.

    About the race condition:
        between the read of the images docker ids and the commit to the
        db of the mappings a new environment could have been built, an
        image could have become nameless and be subsequently removed
        because the image mappings were not in the db yet, and we would
        end up with  mappings that are pointing to an image that does
        not exist.  If we would only check for the existence of the img
        we could still be in a race condition, so we must act on the
        image becoming nameless, not deleted.

    Args:
        run_id:
        project_uuid:
        environment_uuids:

    Returns:
        A dictionary mapping environment uuids to the docker id
        of the image, so that the run steps can make use of those
        images knowingly that the images won't be deleted, even
        if they become outdated.

    """
    model = models.PipelineRunImageMapping

    # Read the current docker image ids of each env.
    env_uuid_docker_id_mappings = get_env_uuids_to_docker_id_mappings(
        project_uuid, environment_uuids
    )

    # Write to the db the image_uuids and docker ids the run uses this
    # is our first lock attempt.
    run_image_mappings = [
        model(
            **{
                "run_uuid": run_id,
                "orchest_environment_uuid": env_uuid,
                "docker_img_id": docker_id,
            }
        )
        for env_uuid, docker_id in env_uuid_docker_id_mappings.items()
    ]
    db.session.bulk_save_objects(run_image_mappings)
    # Note that the commit(s) in this function are necessary to be able
    # to "lock" the images, i.e. we need to have the data in the db
    # ASAP.
    db.session.commit()

    # If the mappings have changed it means that at least 1 image that
    # we are using has become nameless and it is outdated, and might be
    # deleted if we did not lock in time, i.e. if we got on the base
    # side of the race condition.
    env_uuid_docker_id_mappings2 = get_env_uuids_to_docker_id_mappings(
        project_uuid, environment_uuids
    )
    while set(env_uuid_docker_id_mappings.values()) != set(
        env_uuid_docker_id_mappings2.values()
    ):
        # Get which environment images have been updated between the
        # moment we read the docker id and the commit to db, this is a
        # lock attempt.
        mappings_to_update = set(env_uuid_docker_id_mappings2.items()) - set(
            env_uuid_docker_id_mappings.items()
        )
        for env_uuid, docker_id in mappings_to_update:
            model.query.filter(
                # Same task.
                model.run_uuid == run_id,
                # Same environment.
                model.orchest_environment_uuid == env_uuid
                # Update docker id to which the run will point to.
            ).update({"docker_img_id": docker_id})
        db.session.commit()

        env_uuid_docker_id_mappings = env_uuid_docker_id_mappings2

        # The next time we check for equality, if they are equal that
        # means that we know that we are pointing to images that won't
        # be deleted because the run is already in the db as PENDING.
        env_uuid_docker_id_mappings2 = get_env_uuids_to_docker_id_mappings(
            project_uuid, environment_uuids
        )
    return env_uuid_docker_id_mappings


def lock_environment_images_for_session(
    project_uuid: str, pipeline_uuid: str, environment_uuids: Set[str]
) -> Dict[str, str]:
    """Retrieve the docker ids to use for the services of a session.

    See lock_environment_images_for_run for more details.
    This is only necessary for services which used orchest environments.

    Args:
        project_uuid:
        pipeline_uuid:
        environment_uuids:

    Returns:
        A dictionary mapping environment uuids to the docker id of the
        image, so that the session can make use of those images
        knowingly that the images won't be deleted, even if they become
        outdated.

    """
    model = models.InteractiveSessionImageMapping

    env_uuid_docker_id_mappings = get_env_uuids_to_docker_id_mappings(
        project_uuid, environment_uuids
    )

    session_image_mappings = [
        model(
            **{
                "project_uuid": project_uuid,
                "pipeline_uuid": pipeline_uuid,
                "orchest_environment_uuid": env_uuid,
                "docker_img_id": docker_id,
            }
        )
        for env_uuid, docker_id in env_uuid_docker_id_mappings.items()
    ]
    db.session.bulk_save_objects(session_image_mappings)
    db.session.commit()

    env_uuid_docker_id_mappings2 = get_env_uuids_to_docker_id_mappings(
        project_uuid, environment_uuids
    )
    while set(env_uuid_docker_id_mappings.values()) != set(
        env_uuid_docker_id_mappings2.values()
    ):
        mappings_to_update = set(env_uuid_docker_id_mappings2.items()) - set(
            env_uuid_docker_id_mappings.items()
        )
        for env_uuid, docker_id in mappings_to_update:
            model.query.filter(
                model.project_uuid == project_uuid,
                model.pipeline_uuid == pipeline_uuid,
                model.orchest_environment_uuid == env_uuid,
            ).update({"docker_img_id": docker_id})
        db.session.commit()

        env_uuid_docker_id_mappings = env_uuid_docker_id_mappings2

        env_uuid_docker_id_mappings2 = get_env_uuids_to_docker_id_mappings(
            project_uuid, environment_uuids
        )
    return env_uuid_docker_id_mappings


def lock_environment_images_for_job(
    job_uuid: str, project_uuid: str, environment_uuids: Set[str]
) -> Dict[str, str]:
    """Retrieve the docker ids to use for the runs of a job.

    See lock_environment_images_for_run for more details.

    Args:
        job_uuid:
        project_uuid:
        environment_uuids:

    Returns:
        A dictionary mapping environment uuids to the docker id of the
        image, so that a job can make use of those images knowingly that
        the images won't be deleted, even if they become outdated.

    """
    model = models.JobImageMapping

    env_uuid_docker_id_mappings = get_env_uuids_to_docker_id_mappings(
        project_uuid, environment_uuids
    )

    job_image_mappings = [
        model(
            **{
                "job_uuid": job_uuid,
                "orchest_environment_uuid": env_uuid,
                "docker_img_id": docker_id,
            }
        )
        for env_uuid, docker_id in env_uuid_docker_id_mappings.items()
    ]
    db.session.bulk_save_objects(job_image_mappings)
    db.session.commit()

    env_uuid_docker_id_mappings2 = get_env_uuids_to_docker_id_mappings(
        project_uuid, environment_uuids
    )
    while set(env_uuid_docker_id_mappings.values()) != set(
        env_uuid_docker_id_mappings2.values()
    ):
        mappings_to_update = set(env_uuid_docker_id_mappings2.items()) - set(
            env_uuid_docker_id_mappings.items()
        )
        for env_uuid, docker_id in mappings_to_update:
            model.query.filter(
                model.job_uuid == job_uuid,
                model.orchest_environment_uuid == env_uuid,
            ).update({"docker_img_id": docker_id})
        db.session.commit()

        env_uuid_docker_id_mappings = env_uuid_docker_id_mappings2

        env_uuid_docker_id_mappings2 = get_env_uuids_to_docker_id_mappings(
            project_uuid, environment_uuids
        )
    return env_uuid_docker_id_mappings


def interactive_runs_using_environment(project_uuid: str, env_uuid: str):
    """Get the list of interactive runs using a given environment.

    Args:
        project_uuid:
        env_uuid:

    Returns:
    """
    return models.InteractivePipelineRun.query.filter(
        models.InteractivePipelineRun.project_uuid == project_uuid,
        models.InteractivePipelineRun.image_mappings.any(
            orchest_environment_uuid=env_uuid
        ),
        models.InteractivePipelineRun.status.in_(["PENDING", "STARTED"]),
    ).all()


def interactive_sessions_using_environment(project_uuid: str, env_uuid: str):
    """Get the list of interactive sessions using a given environment.

    Args:
        project_uuid:
        env_uuid:

    Returns:
    """
    return models.InteractiveSession.query.filter(
        models.InteractiveSession.project_uuid == project_uuid,
        models.InteractiveSession.image_mappings.any(orchest_environment_uuid=env_uuid),
    ).all()


def jobs_using_environment(project_uuid: str, env_uuid: str):
    """Get the list of jobs using a given environment.

    Args:
        project_uuid:
        env_uuid:

    Returns:
    """

    return models.Job.query.filter(
        models.Job.project_uuid == project_uuid,
        models.Job.image_mappings.any(orchest_environment_uuid=env_uuid),
        models.Job.status.in_(["DRAFT", "PENDING", "STARTED"]),
    ).all()


def is_environment_in_use(project_uuid: str, env_uuid: str) -> bool:
    """True if the environment is or will be in use by a run/job

    Args:
        env_uuid:

    Returns:
        bool:
    """

    int_runs = interactive_runs_using_environment(project_uuid, env_uuid)
    int_sess = interactive_sessions_using_environment(project_uuid, env_uuid)
    jobs = jobs_using_environment(project_uuid, env_uuid)
    return len(int_runs) > 0 or len(int_sess) > 0 or len(jobs) > 0


def is_docker_image_in_use(img_id: str) -> bool:
    """True if the image is or will be in use by a run/job

    Args:
        img_id:

    Returns:
        bool:
    """

    int_runs = models.PipelineRun.query.filter(
        models.PipelineRun.image_mappings.any(docker_img_id=img_id),
        models.PipelineRun.status.in_(["PENDING", "STARTED"]),
    ).all()

    int_sessions = models.InteractiveSession.query.filter(
        models.InteractiveSession.image_mappings.any(docker_img_id=img_id),
    ).all()

    jobs = models.Job.query.filter(
        models.Job.image_mappings.any(docker_img_id=img_id),
        models.Job.status.in_(["DRAFT", "PENDING", "STARTED"]),
    ).all()

    return bool(int_runs) or bool(int_sessions) or bool(jobs)


def remove_if_dangling(img) -> bool:
    """Remove an image if its dangling.

    A dangling image is an image that is nameless and tag-less,
    and for which no runs exist that are PENDING or STARTED and that
    are going to use this image in one of their steps.

    Args:
        img:

    Returns:
        True if the image was successfully removed.
        False if not, e.g. if it is not nameless or if it is being used
        or will be used by a run.

    """
    # nameless image
    if len(img.attrs["RepoTags"]) == 0 and not is_docker_image_in_use(img.id):
        # need to check multiple times because of a race condition
        # given by the fact that cleaning up a project will
        # stop runs and jobs, then cleanup images and dangling
        # images, it might be that the celery worker running the task
        # still has to shut down the containers
        tries = 10
        while tries > 0:
            try:
                docker_client.images.remove(img.id)
                return True
            except errors.ImageNotFound:
                return False
            except Exception as e:
                current_app.logger.warning(
                    f"exception during removal of image {img.id}:\n{e}"
                )
                pass
            time.sleep(1)
            tries -= 1
    return False


def get_proj_pip_env_variables(project_uuid: str, pipeline_uuid: str) -> Dict[str, str]:
    """

    Args:
        project_uuid:
        pipeline_uuid:

    Returns:
        Environment variables resulting from the merge of the project
        and pipeline environment variables, giving priority to pipeline
        variables, e.g. they override project variables.
    """
    project_env_vars = (
        models.Project.query.options(undefer(models.Project.env_variables))
        .filter_by(uuid=project_uuid)
        .one()
        .env_variables
    )
    pipeline_env_vars = (
        models.Pipeline.query.options(undefer(models.Pipeline.env_variables))
        .filter_by(project_uuid=project_uuid, uuid=pipeline_uuid)
        .one()
        .env_variables
    )
    return {**project_env_vars, **pipeline_env_vars}


def get_logger() -> logging.Logger:
    try:
        return current_app.logger
    except Exception:
        pass
    return get_task_logger(__name__)


def process_stale_environment_images(project_uuid: Optional[str] = None) -> None:
    """Make stale environments unavailable to the user.

    Args:
        project_uuid: If specified, only this project environment images
            will be processed.

    After an update, all environment images are invalidated to avoid the
    user having an environment with an SDK not compatible with the
    latest version of Orchest. At the same time, we need to maintain
    environment images that are in use by jobs. Environment images that
    are stale and are not in use by any job get deleted.  Orchest-ctl
    marks all environment images as "stale" on update, by adding a new
    name/tag to them. This function goes through all environments
    images, looking for images that have been marked as stale. Stale
    images have their "real" name, orchest-env-<proj_uuid>-<env_uuid>
    removed, so that the environment will have to be rebuilt to be
    available to the user for new runs.  The invalidation semantics are
    tied with the semantics of the validation module, which considers an
    environment as existing based on the existance of the orchest-env-*
    name.

    """
    filters = {"label": ["_orchest_env_build_is_intermediate=0"]}
    if project_uuid is not None:
        filters["label"].append(f"_orchest_project_uuid={project_uuid}")

    env_imgs = docker_images_list_safe(docker_client, filters=filters)
    for img in env_imgs:
        _process_stale_environment_image(img)


def _process_stale_environment_image(img) -> None:
    pr_uuid = img.labels.get("_orchest_project_uuid")
    env_uuid = img.labels.get("_orchest_environment_uuid")
    build_uuid = img.labels.get("_orchest_env_build_task_uuid")

    env_name = _config.ENVIRONMENT_IMAGE_NAME.format(
        project_uuid=pr_uuid, environment_uuid=env_uuid
    )

    removal_name = _config.ENVIRONMENT_IMAGE_REMOVAL_NAME.format(
        project_uuid=pr_uuid, environment_uuid=env_uuid, build_uuid=build_uuid
    )

    if (
        pr_uuid is None
        or env_uuid is None
        or build_uuid is None
        or
        # The image has not been marked for removal. This will happen
        # everytime Orchest is started except for a start which is
        # following an update.
        f"{removal_name}:latest" not in img.tags
        # Note that we can't check for env_name:latest not being in
        # img.tags because it might not be there if the image has
        # "survived" two updates in a row because a job is still
        # using that.
    ):
        return

    # This will just remove the orchest-env-* name/tag from the
    # image, the image will still be available for jobs that are
    # making use of that because the image still have the
    # <removal_name>.
    if f"{env_name}:latest" in img.tags:
        docker_images_rm_safe(docker_client, env_name)

    if not is_docker_image_in_use(img.id):
        # Delete through id, hence deleting the image regardless
        # of the fact that it has other tags. force=True is used to
        # delete regardless of the existence of stopped containers, this
        # is required because pipeline runs PUT to the orchest-api their
        # finished state before deleting their stopped containers.
        docker_images_rm_safe(docker_client, img.id, attempt_count=20, force=True)
