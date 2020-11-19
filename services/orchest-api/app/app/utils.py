from datetime import datetime
from typing import Dict
import requests
import logging

from docker import errors
from flask_restplus import Model, Namespace

from app import schema
from app.connections import db, docker_client
import app.models as models


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
    return docker_client.images.get(name_or_id).id


def remove_if_dangling(docker_image_id: str):
    """Remove an image if its dangling.

    A dangling image is an image that is nameless and tagless, and for which no runs exist that are PENDING
    or STARTED and that are going to use this image in one of their steps.

    Args:
        docker_image_id:

    Returns:

    """
    # use try-catch block because the image might have been cleaned up by a concurrent request
    try:
        img = docker_client.images.get(docker_image_id)
    except errors.ImageNotFound:
        return False
    # nameless image
    if len(img.attrs["RepoTags"]) == 0:
        int_runs = models.InteractiveRun.query.filter(
            models.InteractiveRun.image_mappings.any(docker_img_id=docker_image_id),
            models.InteractiveRun.status.in_(["PENDING", "STARTED"]),
        ).all()
        non_int_runs = models.NonInteractiveRun.query.filter(
            models.NonInteractiveRun.image_mappings.any(docker_img_id=docker_image_id),
            models.NonInteractiveRun.status.in_(["PENDING", "STARTED"]),
        ).all()

        # the image will not be used anymore, since no run that is PENDING or STARTED is pointing to it
        # and the image is nameless, meaning that all future runs using the same environment will use another image
        if len(int_runs) == 0 and len(non_int_runs) == 0:
            # use try-catch block because the image might have been cleaned up by a concurrent request
            try:
                docker_client.images.remove(docker_image_id)
            except errors.ImageNotFound:
                return False
    return True
