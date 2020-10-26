"""Options for the command line."""

import logging
import os
import pathlib
import subprocess

import typer

from app import config, utils

# Import the CONTAINER_MAPPING seperately because when Orchest is
# started in DEV mode, then the mapping is changed in-place.
from app.config import CONTAINER_MAPPING
from app.connections import docker_client


def restart():
    stop()
    start()


def proxy_certs_exist_on_host():
    certs_path = "/orchest-host/services/nginx-proxy/certs/"

    if os.path.isfile(os.path.join(certs_path, "server.crt")) and os.path.isfile(
        os.path.join(certs_path, "server.key")
    ):
        return True
    else:
        return False


def start():
    # Make sure the installation is complete before starting Orchest.
    if not utils.is_install_complete():
        typer.echo("Installation required. Starting installer.")
        utils.install_images()
        utils.install_network()
        typer.echo("Installation finished. Attempting to start...")
        return start()

    # Dynamically mount certs directory based on whether it exists in
    # nginx-proxy directory on host
    if proxy_certs_exist_on_host():
        CONTAINER_MAPPING["orchestsoftware/nginx-proxy:latest"]["mounts"].append(
            {
                "source": os.path.join(
                    config.ENVS["HOST_REPO_DIR"], "services", "nginx-proxy", "certs"
                ),
                "target": "/etc/ssl/certs",
            }
        )
    else:
        # in case no certs are found don't expose 443 on host
        del CONTAINER_MAPPING["orchestsoftware/nginx-proxy:latest"]["ports"]["443/tcp"]

    if config.RUN_MODE == "dev":
        logging.info(
            "Starting Orchest in DEV mode. This mounts host directories "
            "to monitor for source code changes."
        )

        utils.dev_mount_inject(CONTAINER_MAPPING)
    else:
        typer.echo("[Start]: ...")

    # Clean up lingering, old images from previous starts.
    utils.clean_containers()

    # TODO: is the repo tag always the first tag in the Docker
    #       Engine API?
    # Determine the containers that are already running as we do not
    # want to run these again.
    running_containers = docker_client.containers.list()
    running_container_images = [
        running_container.image.tags[0]
        for running_container in running_containers
        if len(running_container.image.tags) > 0
    ]

    images_to_start = [
        image_name
        for image_name in config.ON_START_IMAGES
        if image_name not in running_container_images
    ]

    # Run every container that is not already running. Additionally,
    # use pre-defined container specifications if the container has
    # any.
    for container_image in images_to_start:
        container_spec = CONTAINER_MAPPING.get(container_image, {})
        run_config = utils.convert_to_run_config(container_image, container_spec)

        logging.info("Starting image %s" % container_image)
        docker_client.containers.run(**run_config)

    utils.log_server_url()


def stop(skip_names=[]):
    typer.echo("[Shutdown]: ...")

    # always skip orchest-ctl
    skip_names.append("orchest-ctl")

    containers = docker_client.containers.list(all=True)
    for container in containers:

        # if name is in skip_names
        if container.name in skip_names:
            continue

        # only kill containers in `orchest` network
        if "orchest" in container.attrs["NetworkSettings"]["Networks"]:
            logging.info("Killing container %s" % container.name)
            try:
                container.kill()
            except Exception:
                # logging.debug(e) (kill() does not always succeed - e.g.
                # container could have exited before)
                pass

            try:
                container.remove()
            except Exception:
                # logging.debug(e) (remove() does not always succeed - e.g. the
                # container could be configured to autoremove)
                pass
    else:
        typer.echo("[Shutdown]: success")


def status():
    running_containers = docker_client.containers.list()

    orchest_container_names = [
        CONTAINER_MAPPING[container_key]["name"] for container_key in CONTAINER_MAPPING
    ]

    running_prints = [""]
    not_running_prints = [""]

    for container in running_containers:
        if container.name in orchest_container_names:
            running_prints.append("Container %s running." % container.name)
            orchest_container_names.remove(container.name)

    for container_name in orchest_container_names:
        not_running_prints.append("Container %s not running." % container_name)

    if len(running_prints) == 1:
        typer.echo("[Status]: not running")
    elif len(running_prints) > 1:
        typer.echo("[Status]: running")
        logging.info("\n".join(running_prints))

    if len(not_running_prints) > 1:
        logging.info("\n".join(not_running_prints))


def _updateserver():
    logging.info("Starting Orchest update service")

    container_image = "orchestsoftware/update-server:latest"
    container_spec = CONTAINER_MAPPING.get(container_image, {})
    run_config = utils.convert_to_run_config(container_image, container_spec)

    logging.info("Starting image %s" % container_image)
    docker_client.containers.run(**run_config)


def update():
    typer.echo("[Update]: ...")

    # stopping Orchest
    logging.info("[Shutdown]: ...")

    # only start if it was running
    should_restart = utils.is_orchest_running()

    if config.UPDATE_MODE != "web":
        stop()
    else:
        # Both nginx-proxy/update-server are left running
        # during the update to support _updateserver
        stop(skip_names=["nginx-proxy", "update-server"])

    # Update git repository to get the latest changes to the ``userdir``
    # structure.
    logging.info("Updating repo ...")
    script_path = os.path.join(
        "/orchest", "services", "orchest-ctl", "app", "scripts", "git-update.sh"
    )
    script_process = subprocess.Popen([script_path], cwd="/orchest-host", bufsize=0)
    return_code = script_process.wait()

    if return_code != 0:
        logging.info(
            "'git' repo update failed. Please make sure you don't have "
            "any commits that conflict with the main branch in the "
            "'orchest' repository. Cancelling update."
        )
    else:
        logging.info("Pulling latest images ...")
        utils.install_images(force_pull=True)

    typer.echo("[Update]: success")

    if config.UPDATE_MODE != "web" and should_restart:
        start()
