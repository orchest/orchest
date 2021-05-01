"""Module to manage the lifecycle of Orchest.

TODO:
    * Improve the start/stop so that containers are not removed. Instead
      containers can just be restarted (preserving their logs). Update
      should then remove old containers to make sure the updated ones
      are used.
    * In Python3.9 PEP585 will be introduced, deprecating certain typing
      functionality. See: https://www.python.org/dev/peps/pep-0585/

"""
import logging
import os
import time
from functools import reduce
from typing import List, Optional, Set, Tuple

import typer

from app import spec, utils
from app.config import ORCHEST_IMAGES, _on_start_images
from app.debug import debug_dump, health_check
from app.docker_wrapper import DockerWrapper, OrchestResourceManager

logger = logging.getLogger(__name__)


class OrchestApp:
    """..."""

    def __init__(self):
        self.resource_manager = OrchestResourceManager()
        self.docker_client = DockerWrapper()

    def install(self, language: str, gpu: bool = False):
        """Installs Orchest for the given language.

        Pulls all the Orchest containers necessary to run all the
        features for the given `language`.

        """
        self.resource_manager.install_network()

        # Check whether the install is complete.
        pulled_images = self.resource_manager.get_images()
        req_images = get_required_images(language, gpu)
        missing_images = set(req_images) - set(pulled_images)

        if not missing_images:
            utils.echo("Installation is already complete. Did you mean to run:")
            utils.echo("\torchest update")
            return

        # The installation is not yet complete, but some images were
        # already pulled before.
        if pulled_images:
            utils.echo("Some images have been pulled before. Don't forget to run:")
            utils.echo("\torchest update")
            utils.echo(
                "after the installation is finished to ensure that all images are"
                " running the same version of Orchest.",
            )

        utils.echo("Installing Orchest...")
        logger.info("Pulling images:\n" + "\n".join(missing_images))
        self.docker_client.pull_images(missing_images, prog_bar=True)

    def start(self, container_config: dict):
        """Starts Orchest.

        Raises:
            ValueError: If the `container_config` does not contain a
                configuration for every image that is supposed to run
                on start.

        """
        # Check whether the minimal set of images is present for Orchest
        # to be started.
        pulled_images = self.resource_manager.get_images()
        req_images: Set[str] = reduce(lambda x, y: x.union(y), _on_start_images, set())
        missing_images = req_images - set(pulled_images)

        if missing_images or not self.resource_manager.is_network_installed():
            utils.echo("Before starting Orchest, make sure Orchest is installed. Run:")
            utils.echo("\torchest install")
            return

        # Check whether the container config contains the set of
        # required images.
        present_imgs = set(config["Image"] for config in container_config.values())
        if present_imgs < req_images:  # proper subset
            raise ValueError(
                "The container_config does not contain a configuration for "
                " every required image: " + ", ".join(req_images)
            )

        # Orchest is already running
        ids, running_containers = self.resource_manager.get_containers(state="running")
        if not (req_images - set(running_containers)):
            # TODO: Ideally this would print the port on which Orchest
            #       is running. (Was started before and so we do not
            #       simply know.)
            utils.echo("Orchest is already running...")
            return

        # Orchest is partially running and thus in an inconsistent
        # state. Possibly the start command was issued whilst Orchest
        # is still shutting down.
        if running_containers:
            utils.echo(
                "Orchest seems to be partially running. Before attempting to start"
                " Orchest, shut the application down first:",
            )
            utils.echo("\torchest stop")
            return

        # Remove old lingering containers.
        ids, exited_containers = self.resource_manager.get_containers(state="exited")
        self.docker_client.remove_containers(ids)

        utils.fix_userdir_permissions()
        logger.info("Fixing permissions on the 'userdir/'.")

        utils.echo("Starting Orchest...")
        logger.info("Starting containers:\n" + "\n".join(req_images))

        # Start the containers in the correct order, keeping in mind
        # dependencies between containers.
        for i, to_start_imgs in enumerate(_on_start_images):
            filter_ = {"Image": to_start_imgs}
            config = spec.filter_container_config(container_config, filter=filter_)
            stdouts = self.docker_client.run_containers(
                config, use_name=True, detach=True
            )

            # TODO: Abstract version of when the next set of images can
            #       be started. In case the `on_start_images` has more
            #       stages.
            if i == 0:
                utils.wait_for_zero_exitcode(
                    self.docker_client,
                    stdouts["orchest-database"]["id"],
                    "pg_isready --username postgres",
                )

                utils.wait_for_zero_exitcode(
                    self.docker_client,
                    stdouts["rabbitmq-server"]["id"],
                    (
                        'su rabbitmq -c "/opt/rabbitmq/sbin/rabbitmq-diagnostics '
                        '-q check_port_connectivity"'
                    ),
                )

        # Get the port on which Orchest is running.
        nginx_proxy = container_config.get("nginx-proxy")
        if nginx_proxy is not None:
            for port, port_binding in nginx_proxy["HostConfig"]["PortBindings"].items():
                exposed_port = port_binding[0]["HostPort"]
                utils.echo(f"Orchest is running at: http://localhost:{exposed_port}")

    def stop(self, skip_containers: Optional[List[str]] = None):
        """Stop the Orchest application.

        Args:
            skip_containers: The names of the images of the containers
                for which the containers are not stopped.

        """

        ids, running_containers = self.resource_manager.get_containers(state="running")
        if not utils.is_orchest_running(running_containers):
            utils.echo("Orchest is not running.")
            return

        # Exclude the orchest-ctl from shutting down itself.
        if skip_containers is None:
            skip_containers = []
        skip_containers += ["orchest/orchest-ctl:latest"]

        ids: Tuple[str]
        running_containers: Tuple[Optional[str]]
        ids, running_containers = list(
            zip(
                *[
                    (id_, c)
                    for id_, c in zip(ids, running_containers)
                    if c not in skip_containers
                ]
            )
        )

        utils.echo("Shutting down...")
        logger.info("Shutting down containers:\n" + "\n".join(running_containers))

        self.docker_client.remove_containers(ids)
        utils.echo("Shutdown successful.")

    def restart(self, container_config: dict):
        """Starts Orchest.

        Raises:
            ValueError: If the `container_config` does not contain a
                configuration for every image that is supposed to run
                on start.

        """
        self.stop()
        self.start(container_config)

    def _updateserver(self, port: int = 8000, cloud: bool = False, dev: bool = False):
        """Starts the update-server service."""
        logger.info("Starting Orchest update service...")

        config = {}
        container_config = spec.get_container_config(port=port, cloud=cloud, dev=dev)
        config["update-server"] = container_config["update-server"]

        self.docker_client.run_containers(config, use_name=True, detach=True)

    def status(self, ext=False):

        _, running_containers_names = self.resource_manager.get_containers(
            state="running"
        )

        if not utils.is_orchest_running(running_containers_names):
            utils.echo("Orchest is not running.")
            raise typer.Exit(code=1)

        # Minimal set of containers to be running for Orchest to be in
        # a valid state.
        valid_set: Set[str] = reduce(lambda x, y: x.union(y), _on_start_images, set())

        if valid_set - set(running_containers_names):
            utils.echo("Orchest is running, but has reached an invalid state. Run:")
            utils.echo("\torchest restart")
            logger.warning(
                "Orchest has reached an invalid state. Running containers:\n"
                + "\n".join(running_containers_names)
            )
            raise typer.Exit(code=2)
        else:
            utils.echo("Orchest is running.")
            if ext:
                utils.echo("Performing extensive status checks...")
                no_issues = True
                for container, exit_code in health_check(self.resource_manager).items():
                    if exit_code != 0:
                        no_issues = False
                        utils.echo(f"{container} is not ready ({exit_code}).")

                if no_issues:
                    utils.echo("All services are ready.")
                else:
                    raise typer.Exit(code=3)

    def update(self, mode=None):
        """Update Orchest.

        Args:
            mode: The mode in which to update Orchest. This is either
                ``None`` or ``"web"``, where the latter is used when
                update is invoked through the update-server.

        """
        # Get all installed containers.
        pulled_images = self.resource_manager.get_images()

        # Pull images. It is possible to pull new image whilst the older
        # versions of those images are running.
        # TODO: remove the warning from the orchest.sh script that
        #       containers will be shut down.
        utils.echo("Updating...")

        _, running_containers = self.resource_manager.get_containers(state="running")
        if utils.is_orchest_running(running_containers):
            utils.echo(
                "Using Orchest whilst updating is NOT supported and will be shut"
                " down, killing all active pipeline runs and session. You have 2s"
                " to cancel the update operation."
            )

            # Give the user the option to cancel the update operation
            # using a keyboard interrupt.
            time.sleep(2)

            self.stop(
                skip_containers=[
                    "orchest/update-server:latest",
                    "orchest/auth-server:latest",
                    "orchest/nginx-proxy:latest",
                    "postgres:13.1",
                ]
            )

        # Update the Orchest git repo to get the latest changes to the
        # "userdir/" structure.
        exit_code = utils.update_git_repo()
        if exit_code != 0:
            utils.echo("Cancelling update...")
            utils.echo(
                "It seems like you have unstaged changes in the 'orchest'"
                " repository. Please commit or stash them as 'orchest update'"
                " pulls the newest changes to the 'userdir/' using a rebase.",
            )
            logger.error("Failed update due to unstaged changes.")
            return

        logger.info("Updating images:\n" + "\n".join(pulled_images))
        self.docker_client.pull_images(pulled_images, prog_bar=True, force=True)

        # Delete user-built environment images to avoid the issue of
        # having environments with mismatching Orchest SDK versions.
        logger.info("Deleting user-built environment images.")
        self.resource_manager.remove_env_build_imgs()

        # Delete user-built Jupyter image to make sure the Jupyter
        # server is updated to the latest version of Orchest.
        logger.info("Deleting user-built Jupyter image.")
        self.resource_manager.remove_jupyter_build_imgs()

        # We invoke the Orchest restart from the webserver ui-updater.
        # Hence we do not show the message to restart manually.
        if mode == "web":
            utils.echo("Update completed.")
        else:
            # Let the user know they need to restart the application
            # for the changes to take effect. NOTE: otherwise Orchest
            # might also be running a mix of containers on different
            # versions.
            utils.echo(
                "Don't forget to restart Orchest for the changes to take effect:"
            )
            utils.echo("\torchest restart")

    def version(self, ext=False):
        """Returns the version of Orchest.

        Args:
            ext: If True return the extensive version of Orchest.
                Meaning that the version of every pulled image is
                checked.

        """
        if not ext:
            version = os.getenv("ORCHEST_VERSION")
            utils.echo(f"Orchest version: {version}")
            return

        utils.echo("Getting versions of all containers...")

        stdouts = self.resource_manager.containers_version()
        stdout_values = set()
        for img, stdout in stdouts.items():
            stdout_values.add(stdout)
            utils.echo(f"{img:<44}: {stdout}")

        # If not all versions are the same.
        if len(stdout_values) > 1:
            utils.echo(
                "Not all containers are running on the same version of Orchest, which"
                " can lead to the application crashing. You can fix this by running:",
            )
            utils.echo("\torchest update")
            utils.echo("To get all containers on the same version again.")

    def debug(self, ext: bool, compress: bool):
        debug_dump(ext, compress)

    def add_user(self, username, password, token, is_admin):
        """Adds a new user to Orchest.

        Args:
            username:
            password:
            token:
            is_admin:
        """

        ids, running_containers = self.resource_manager.get_containers(state="running")
        auth_server_id = None
        database_running = False
        for id, container in zip(ids, running_containers):
            if "postgres" in container:
                database_running = True
            if "auth-server" in container:
                auth_server_id = id

        if not database_running:
            utils.echo("The orchest-database service needs to be running.", err=True)
            raise typer.Exit(code=1)

        if auth_server_id is None:
            utils.echo("The auth-server service needs to be running.", err=True)
            raise typer.Exit(code=1)

        cmd = f"python add_user.py {username} {password}"
        if token:
            cmd += f" --token {token}"
        if is_admin:
            cmd += " --is_admin"

        exit_code = self.docker_client.exec_runs([(auth_server_id, cmd)])[0]

        if exit_code != 0:
            utils.echo(
                (
                    "Non zero exit code whilst trying to add a user to "
                    f"the auth-server: {exit_code}."
                ),
                err=True,
            )

        raise typer.Exit(code=exit_code)


# TODO: Could potentially make this into set as well.
def get_required_images(language: Optional[str], gpu: bool = False) -> List[str]:
    """Returns the needed image for the given install configuration."""
    language_images = {
        "python": ["orchest/base-kernel-py:latest"],
        "r": ["orchest/base-kernel-r:latest"],
        "julia": ["orchest/base-kernel-julia:latest"],
    }
    gpu_images = {
        "python": ["orchest/base-kernel-py-gpu:latest"],
    }

    required_images = ORCHEST_IMAGES["minimal"]

    if language == "all":
        for lang, _ in language_images.items():
            required_images += language_images[lang]

            if lang in gpu_images:
                required_images += gpu_images[lang]

    elif language is not None:
        required_images += language_images[language]

        if gpu:
            required_images += gpu_images[language]

    return required_images
