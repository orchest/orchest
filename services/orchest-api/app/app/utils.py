from datetime import datetime, time
from typing import Dict, Set, Union
import requests
import logging

from docker import errors
from flask_restplus import Model, Namespace
from sqlalchemy import and_

from app import schema
from app.connections import db, docker_client
import app.models as models
from _orchest.internals import config as _config


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

    logging.info("Shutting down Jupyter Server at url: %s" % url)

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

    Args:
        status_update: The new status {'status': 'STARTED'}.
        model: Database model to update the status of.
        filter_by: The filter to query the exact resource for which to
            update its status.

    """
    data = status_update

    if data["status"] == "STARTED":
        data["started_time"] = datetime.fromisoformat(data["started_time"])
    elif data["status"] in ["SUCCESS", "FAILURE"]:
        data["finished_time"] = datetime.fromisoformat(data["finished_time"])

    res = model.query.filter_by(**filter_by).update(data)

    if res:
        db.session.commit()

    return


def get_environment_image_docker_id(name_or_id: str):
    try:
        return docker_client.images.get(name_or_id).id
    except errors.ImageNotFound:
        return None


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
    missing_images = [
        str(errors.ImageNotFound(f"{env_uuid} has no docker image"))
        for env_uuid, docker_id in env_uuid_docker_id_mappings.items()
        if docker_id is None
    ]
    if len(missing_images) > 0:
        raise errors.ImageNotFound("\n".join(missing_images))
    return env_uuid_docker_id_mappings


def lock_environment_images_for_run(
    run_id: str, project_uuid: str, environment_uuids: Set[str]
) -> Dict[str, str]:
    """Retrieve the docker ids to use for a pipeline run.

    Locks a set of environment images by making it so that they will
    not be deleted by the attempt cleanup that follows an environment
    build.
    This is done by adding some entries to the db that will signal
    the fact that the image will be used by a run, as long as the
    run is PENDING or STARTED.
    In order to avoid a race condition that happens between
    reading the docker ids of the used environment and actually
    writing to db, some logic needs to take place, such logic constitutes
    the bulk of this function.
    As a collateral effect, new entries for interactive or non
    interactive image mappings will be added, which is at the same
    time the mechanism through which we "lock" the images, or, protect
    them from deletion as long as they are needed.
    About the race condition:
        between the read of the images docker ids and the commit
        to the db of the mappings a new environment could have been
        built, an image could have become nameless and be
        subsequently removed because the image mappings were not
        in the db yet, and we would end up with  mappings that are
        pointing to an image that does not exist.
        If we would only check for the existence of the img we could
        still be in a race condition, so we must act on the image
        becoming nameless, not deleted.

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

    # read the current docker image ids of each env
    env_uuid_docker_id_mappings = get_env_uuids_to_docker_id_mappings(
        project_uuid, environment_uuids
    )

    # write to the db the image_uuids and docker ids the run uses
    # this is our first lock attempt
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
    db.session.commit()

    # if the mappings have changed it means that at least 1 image
    # that we are using has become nameless and it is outdated, and
    # might be deleted if we did not lock in time, i.e. if we got
    # on the base side of the race condition
    env_uuid_docker_id_mappings2 = get_env_uuids_to_docker_id_mappings(
        project_uuid, environment_uuids
    )
    while set(env_uuid_docker_id_mappings.values()) != set(
        env_uuid_docker_id_mappings2.values()
    ):
        # get which environment images have been updated
        # between the moment we read the docker id and the
        # commit to db, this is a lock attempt
        mappings_to_update = set(env_uuid_docker_id_mappings2.items()) - set(
            env_uuid_docker_id_mappings.items()
        )
        for env_uuid, docker_id in mappings_to_update:
            model.query.filter(
                # same task
                model.run_uuid == run_id,
                # same environment
                model.orchest_environment_uuid == env_uuid
                # update docker id to which the run will point to
            ).update({"docker_img_id": docker_id})
        db.session.commit()

        env_uuid_docker_id_mappings = env_uuid_docker_id_mappings2

        # the next time we check for equality,
        # if they are equal that means that we know that we are
        # pointing to images that won't be deleted because the
        # run is already in the db as PENDING
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


def experiments_using_environment(project_uuid: str, env_uuid: str):
    """Get the list of experiments using a given environment.

    Args:
        project_uuid:
        env_uuid:

    Returns:
    """
    return models.Experiment.query.filter(
        # exp related to this project
        models.Experiment.project_uuid == project_uuid,
        # keep project for which at least a run uses the environment
        # and is or will make use of the environment (PENDING/STARTED)
        models.Experiment.pipeline_runs.any(
            and_(
                models.NonInteractivePipelineRun.image_mappings.any(
                    orchest_environment_uuid=env_uuid
                ),
                models.NonInteractivePipelineRun.status.in_(["PENDING", "STARTED"]),
            )
        ),
    ).all()


def is_environment_in_use(project_uuid: str, env_uuid: str) -> bool:
    """True if the environment is or will be in use by a run/experiment

    Args:
        env_uuid:

    Returns:
        bool:
    """

    int_runs = interactive_runs_using_environment(project_uuid, env_uuid)
    exps = experiments_using_environment(project_uuid, env_uuid)
    return len(int_runs) > 0 or len(exps) > 0


def is_docker_image_in_use(img_id: str) -> bool:
    """True if the image is or will be in use by a run/experiment

    Args:
        img_id:

    Returns:
        bool:
    """

    runs = models.PipelineRun.query.filter(
        models.PipelineRun.image_mappings.any(docker_img_id=img_id),
        models.PipelineRun.status.in_(["PENDING", "STARTED"]),
    ).all()
    return bool(runs)


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
        # stop runs and experiments, then cleanup images and dangling
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
                logging.warning(f"exception during removal of image {img.id}:\n{e}")
                pass
            time.sleep(1)
            tries -= 1
    return False


def parse_string_memory_size(memory_size: Union[str, int]) -> int:
    """Simply converts string description of memory size to number of bytes

    Allowable inputs are: [\d]+\s*(KB|MB|GB)+
    """

    # seems like this is already int (assumed to be number of bytes)
    if isinstance(memory_size, int):
        return memory_size

    conversion = {"KB": 1000, "MB": 1000 ** 2, "GB": 1000 ** 3}
    size, unit = memory_size[:-2], memory_size[-2:]
    size = int(float(size) * conversion[unit])

    return size


def calculate_shm_size(data_passing_memory_size: int) -> int:
    """Calculates the shm-size for the Docker container.

    Given a size for the memory-server we need to do a certain
    allocation to get to that size. In other words, the `shm-size` for
    the Docker container is not equal to the request size for the
    memory-server.

    If the Plasma server tries to allocate more than is available in /dev/shm it
    will not fail but issue a warning. However, the full amount requested will
    not be available to the user.

    Args:
        data_passing_memory_size: Requested size for the memory-server.

    Returns:
        The shm-size for the Docker container.

    """
    # We need to overallocate by a fraction to make /dev/shm large enough for the
    # request amount in `data_passing_memory_size`
    return int(data_passing_memory_size * 1.2)
