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
    """Retrieve the image ids to use for a pipeline run.

    Locks a set of environment images by making it so that they will
    not be deleted by the attempt cleanup that follows an environment
    build.

    This is done by adding some entries to the db that will signal the
    fact that the image will be used by a run, as long as the run is
    PENDING or STARTED.

    In order to avoid a race condition that happens between reading the
    image ids of the used environment and actually writing to db, some
    logic needs to take place, such logic constitutes the bulk of this
    function.

    As a collateral effect, new entries for interactive or non
    interactive image mappings will be added, which is at the same time
    the mechanism through which we "lock" the images, or, protect them
    from deletion as long as they are needed.

    About the race condition:
        between the read of the images image ids and the commit to the
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
        A dictionary mapping environment uuids to the id of the image,
        so that the run steps can make use of those images knowingly
        that the images won't be deleted, even if they become outdated.

    """
    model = models.PipelineRunImageMapping

    # Read the current image ids of each env.
    env_uuid_image_id_mappings = get_env_uuids_to_image_id_mappings(
        project_uuid, environment_uuids
    )

    # Write to the db the image_uuids and image ids the run uses this
    # is our first lock attempt.
    run_image_mappings = [
        model(
            **{
                "run_uuid": run_id,
                "orchest_environment_uuid": env_uuid,
                "docker_img_id": image_d,
            }
        )
        for env_uuid, image_d in env_uuid_image_id_mappings.items()
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
    env_uuid_image_id_mappings2 = get_env_uuids_to_image_id_mappings(
        project_uuid, environment_uuids
    )
    while set(env_uuid_image_id_mappings.values()) != set(
        env_uuid_image_id_mappings2.values()
    ):
        # Get which environment images have been updated between the
        # moment we read the image id and the commit to db, this is a
        # lock attempt.
        mappings_to_update = set(env_uuid_image_id_mappings2.items()) - set(
            env_uuid_image_id_mappings.items()
        )
        for env_uuid, image_id in mappings_to_update:
            model.query.filter(
                # Same task.
                model.run_uuid == run_id,
                # Same environment.
                model.orchest_environment_uuid == env_uuid
                # Update image id to which the run will point to.
            ).update({"docker_img_id": image_id})
        db.session.commit()

        env_uuid_image_id_mappings = env_uuid_image_id_mappings2

        # The next time we check for equality, if they are equal that
        # means that we know that we are pointing to images that won't
        # be deleted because the run is already in the db as PENDING.
        env_uuid_image_id_mappings2 = get_env_uuids_to_image_id_mappings(
            project_uuid, environment_uuids
        )
    return env_uuid_image_id_mappings


def lock_environment_images_for_session(
    project_uuid: str, pipeline_uuid: str, environment_uuids: Set[str]
) -> Dict[str, str]:
    """Retrieve the image ids to use for the services of a session.

    See lock_environment_images_for_run for more details.
    This is only necessary for services which used orchest environments.

    Args:
        project_uuid:
        pipeline_uuid:
        environment_uuids:

    Returns:
        A dictionary mapping environment uuids to the id of the image,
        so that the session can make use of those images knowingly that
        the images won't be deleted, even if they become outdated.

    """
    model = models.InteractiveSessionImageMapping

    env_uuid_image_id_mappings = get_env_uuids_to_image_id_mappings(
        project_uuid, environment_uuids
    )

    session_image_mappings = [
        model(
            **{
                "project_uuid": project_uuid,
                "pipeline_uuid": pipeline_uuid,
                "orchest_environment_uuid": env_uuid,
                "docker_img_id": image_id,
            }
        )
        for env_uuid, image_id in env_uuid_image_id_mappings.items()
    ]
    db.session.bulk_save_objects(session_image_mappings)
    db.session.commit()

    env_uuid_image_id_mappings2 = get_env_uuids_to_image_id_mappings(
        project_uuid, environment_uuids
    )
    while set(env_uuid_image_id_mappings.values()) != set(
        env_uuid_image_id_mappings2.values()
    ):
        mappings_to_update = set(env_uuid_image_id_mappings2.items()) - set(
            env_uuid_image_id_mappings.items()
        )
        for env_uuid, image_id in mappings_to_update:
            model.query.filter(
                model.project_uuid == project_uuid,
                model.pipeline_uuid == pipeline_uuid,
                model.orchest_environment_uuid == env_uuid,
            ).update({"docker_img_id": image_id})
        db.session.commit()

        env_uuid_image_id_mappings = env_uuid_image_id_mappings2

        env_uuid_image_id_mappings2 = get_env_uuids_to_image_id_mappings(
            project_uuid, environment_uuids
        )
    return env_uuid_image_id_mappings


def lock_environment_images_for_job(
    job_uuid: str, project_uuid: str, environment_uuids: Set[str]
) -> Dict[str, str]:
    """Retrieve the image ids to use for the runs of a job.

    See lock_environment_images_for_run for more details.

    Args:
        job_uuid:
        project_uuid:
        environment_uuids:

    Returns:
        A dictionary mapping environment uuids to the id of the image,
        so that a job can make use of those images knowingly that the
        images won't be deleted, even if they become outdated.

    """
    model = models.JobImageMapping

    env_uuid_image_id_mappings = get_env_uuids_to_image_id_mappings(
        project_uuid, environment_uuids
    )

    job_image_mappings = [
        model(
            **{
                "job_uuid": job_uuid,
                "orchest_environment_uuid": env_uuid,
                "docker_img_id": image_id,
            }
        )
        for env_uuid, image_id in env_uuid_image_id_mappings.items()
    ]
    db.session.bulk_save_objects(job_image_mappings)
    db.session.commit()

    env_uuid_image_id_mappings2 = get_env_uuids_to_image_id_mappings(
        project_uuid, environment_uuids
    )
    while set(env_uuid_image_id_mappings.values()) != set(
        env_uuid_image_id_mappings2.values()
    ):
        mappings_to_update = set(env_uuid_image_id_mappings2.items()) - set(
            env_uuid_image_id_mappings.items()
        )
        for env_uuid, image_id in mappings_to_update:
            model.query.filter(
                model.job_uuid == job_uuid,
                model.orchest_environment_uuid == env_uuid,
            ).update({"docker_img_id": image_id})
        db.session.commit()

        env_uuid_image_id_mappings = env_uuid_image_id_mappings2

        env_uuid_image_id_mappings2 = get_env_uuids_to_image_id_mappings(
            project_uuid, environment_uuids
        )
    return env_uuid_image_id_mappings


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
        models.Job.status.in_(["DRAFT", "PENDING", "STARTED", "PAUSED"]),
    ).all()


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
