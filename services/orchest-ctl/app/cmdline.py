"""Options for the command line."""

import logging
import os
import subprocess
import time

import typer

from app import config, utils

# Import the CONTAINER_MAPPING seperately because when Orchest is
# started in DEV mode, then the mapping is changed in-place.
from app.config import CONTAINER_MAPPING
from app.connections import docker_client


def echo_extensive_versions():
    not_installed_imgs = utils.check_images("all-gpu")

    # TODO: do async
    for img in config.LANGUAGE_IMAGES["all-gpu"]:
        # Images not owned by Orchest will not have the ENV var and we
        # do not want to install containers just to check their version.
        if not img.startswith("orchest") or img in not_installed_imgs:
            continue

        # Use `entrypoint` instead of `command` to overwrite the
        # `entrypoint` inside the container.
        stdout = docker_client.containers.run(
            img, entrypoint=["printenv", "ORCHEST_VERSION"]
        )
        stdout = stdout.decode("utf-8").replace("\n", "")
        typer.echo(f"{img:<44}: {stdout}")


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


def install(language):
    # We do not have to install if it is already complete.
    if utils.is_install_complete(language):
        typer.echo("Installation is already complete.")
        return

    typer.echo(
        "Installation might take some time depending on your network"
        " bandwidth. Starting installation..."
    )
    utils.install_images(language)
    utils.install_network()
    typer.echo("Installation was successful.")


def start():
    # Make sure the installation is complete before starting Orchest.
    if not utils.is_install_complete(language="none"):
        typer.echo("Installation required. To install Orchest run:")
        typer.echo("\torchest install")
        return

    # Dynamically mount certs directory based on whether it exists in
    # nginx-proxy directory on host
    if proxy_certs_exist_on_host():
        CONTAINER_MAPPING["orchest/nginx-proxy:latest"]["mounts"].append(
            {
                "source": os.path.join(
                    config.ENVS["HOST_REPO_DIR"], "services", "nginx-proxy", "certs"
                ),
                "target": "/etc/ssl/certs",
            }
        )
    else:
        # in case no certs are found don't expose 443 on host
        del CONTAINER_MAPPING["orchest/nginx-proxy:latest"]["ports"]["443/tcp"]

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

    # Make sure userdir/ permissions are correct
    utils.fix_userdir_permissions()

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
        container = docker_client.containers.run(**run_config)

        # wait for the db to be accepting connections before launching
        # other containers, this will likely take 1 try or two.
        # TODO: should we have a generic abstraction when it comes to
        # dependencies among the services? I don't think it's needed.
        if container_image.startswith("postgres"):
            exit_code, _ = container.exec_run("pg_isready --username postgres")
            while exit_code != 0:
                exit_code, _ = container.exec_run("pg_isready --username postgres")
                time.sleep(1)

    utils.log_server_url()


def stop(skip_names=[], trace=None):
    # We do not want to print the shutdown in case stop is not called
    # directly as it is possible that Orchest is not even running. The
    # user should use verbosity flags instead.
    if trace is None:
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
                # remove unnamed volumes on shutdown
                container.remove(v=True)
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

    container_image = "orchest/update-server:latest"
    container_spec = CONTAINER_MAPPING.get(container_image, {})
    run_config = utils.convert_to_run_config(container_image, container_spec)

    logging.info("Starting image %s" % container_image)
    docker_client.containers.run(**run_config)


def update(language):
    typer.echo("[Update]: ...")

    # only start if it was running
    should_restart = utils.is_orchest_running()

    if should_restart:
        logging.info("[Shutdown]: ...")

    if config.UPDATE_MODE != "web":
        stop(trace="update")
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
        logging.error(
            "'git' repo update failed. Please make sure you don't have "
            "any commits that conflict with the main branch in the "
            "'orchest' repository. Cancelling update."
        )
    else:
        logging.info("Pulling latest images ...")
        utils.install_images(language, force_pull=True)

    typer.echo("[Update]: success")

    if config.UPDATE_MODE != "web" and should_restart:
        start()
