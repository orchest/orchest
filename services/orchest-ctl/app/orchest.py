"""Module to manage the lifecycle of Orchest.

TODO:
    * Improve the start/stop so that containers are not removed. Instead
      containers can just be restarted (preserving their logs). Update
      should then remove old containers to make sure the updated once
      are used.
    * In Python3.9 PEP585 will be introduced, deprecating certain typing
      functionality. See: https://www.python.org/dev/peps/pep-0585/

"""
import asyncio
import logging
import os
from functools import reduce
from typing import Any, Dict, Iterable, List, Literal, Optional, Set, Tuple, Union

import aiodocker
import docker
from docker.client import DockerClient
from tqdm.asyncio import tqdm

from app import spec, utils
from app.config import DOCKER_NETWORK, ORCHEST_IMAGES, WRAP_LINES

logger = logging.getLogger(__name__)


class DockerWrapper:
    def __init__(self):
        self.sclient = DockerClient.from_env()  # sync
        self._aclient: Optional[aiodocker.Docker] = None  # async

    async def close_aclient(self):
        if self._aclient is not None:
            await self._aclient.close()
            self._aclient = None

    @property
    def aclient(self):
        if self._aclient is None:
            self._aclient = aiodocker.Docker()

        return self._aclient

    def __del__(self):
        # Called when the object is about to be destroyed.
        self.sclient.close()

    def is_network_installed(self, network: str) -> bool:
        """Returns whether the given network is installed."""
        try:
            self.sclient.networks.get(network)
        except docker.errors.NotFound:
            return False
        except docker.errors.APIError as e:
            # TODO: I don't really know whether we want to catch this
            #       error or just let it fail. We cannot let it fail
            #       silently and so I see no need to log it as well
            #       (orchest-ctl is auto-removed).

            # Possible causes can be that the network already exists
            # multiple times, making the request ambiguous.
            logger.error("Unknow error when checking the network: {e}")

            # TODO: raise custom error here
            raise docker.errors.APIError(e)

        return True

    def install_network(self, network: str) -> None:
        self.sclient.networks.create(network, driver="bridge")

    async def _pull_image(self, image: str, force: bool = False) -> None:
        """Pulls an image.

        Args:
            image: The image to pull.
            force: If True, then pulls the image even when it is already
                present and thus replacing it.

        """
        pull_image = False
        try:
            await self.aclient.images.get(image)
        except aiodocker.exceptions.DockerError:
            # Image is not yet installed.
            pull_image = True

        if force or pull_image:
            await self.aclient.images.pull(image)

    async def _pull_images(
        self,
        images: Iterable[str],
        prog_bar: bool = True,
        force: bool = False,
    ):
        pulls = [self._pull_image(image, force=force) for image in images]

        if prog_bar:
            pulls = tqdm.as_completed(
                pulls,
                total=len(pulls),
                ncols=WRAP_LINES,
                desc="Pulling images",
                ascii=True,
                position=0,
                leave=True,
                bar_format="{desc}: {n}/{total}|{bar}|",
            )

        for pull in pulls:
            await pull

        if prog_bar:
            pulls.close()  # type: ignore

            # Makes the next echo start on the line underneath the
            # status bar instead of after.
            await asyncio.sleep(0.05)
            # TODO: Check whether we can use print(flush=True) here to
            #       make this class not dependend on utils.
            utils.echo()

        await self.close_aclient()

    def pull_images(
        self,
        images: Iterable[str],
        prog_bar: bool = True,
        force: bool = False,
    ):
        """Pulls an iterable of images.

        Args:
            images: The images to pull.
            prog_bar: Whether or not to show a progress bar to
                indicate progress.
            force: If True, then pulls an image even when it is already
                present and thus replacing it.

        """
        return asyncio.run(self._pull_images(images, prog_bar=prog_bar, force=force))

    async def _does_image_exist(self, image: str) -> bool:
        try:
            await self.aclient.images.inspect(image)
        except aiodocker.exceptions.DockerError:
            return False

        return True

    async def _do_images_exist(self, images: Iterable[str]) -> List[bool]:
        res = await asyncio.gather(*[self._does_image_exist(image) for image in images])
        await self.close_aclient()

        return res

    def do_images_exist(self, images: Iterable[str]) -> List[bool]:
        """Checks whether the given images exist.

        True if found, False is not. Order in returned list equals
        order of given `images`.
        """
        return asyncio.run(self._do_images_exist(images))

    async def _list_image_ids(self, all: bool = False, label: Optional[str] = None):
        images = await self.aclient.images.list(all=all, filters={"label": [label]})
        await self.close_aclient()

        return [img["Id"] for img in images]

    def list_image_ids(self, all: bool = False, label: Optional[str] = None):
        return asyncio.run(self._list_image_ids(all=all, label=label))

    async def _remove_image(self, image: Iterable[str], force: bool = False):
        await self.aclient.images.delete(image, force=force)

    async def _remove_images(self, image_ids: Iterable[str], force: bool = False):
        await asyncio.gather(
            *[self._remove_image(img, force=force) for img in image_ids]
        )
        await self.close_aclient()

    def remove_images(self, image_ids: Iterable[str], force: bool = False):
        """

        Args:
            image_ids: Iterable of image IDs.
            force: Remove an image even if it is being used by stopped
                   containers or has other tags.

        """
        # TODO: use typing to state that str should be of type ID
        asyncio.run(self._remove_images(image_ids, force=force))

    async def _get_containers(
        self,
        state: Literal["all", "running", "exited"] = "running",
        network: Optional[str] = None,
    ) -> Tuple[List[str], List[Optional[str]]]:
        all_ = True if state in ["all", "exited"] else False
        containers = await self.aclient.containers.list(
            all=all_, filters={"network": [network]}
        )
        await self.close_aclient()

        ids = []
        img_names = []
        for c in containers:
            if state == "exited":
                if c._container.get("State") != "running":
                    img_names.append(c._container.get("Image"))
                    ids.append(c.id)

            else:
                img_names.append(c._container.get("Image"))
                ids.append(c.id)

        return ids, img_names

    def get_containers(
        self,
        state: Literal["all", "running", "exited"] = "running",
        network: Optional[str] = None,
    ) -> Tuple[List[str], List[Optional[str]]]:
        """Returns runnings containers (on a network).

        Args:
            state: The state of the container to be in in order for it
                to be returned.
            network: The network on which to filter the containers.

        Returns:
            (container_ids, img_names) in respective order. Where the
            img_names are the names of the images underlying of the
            containers.

        """
        return asyncio.run(self._get_containers(state=state, network=network))

    async def _remove_containers(self, container_ids: Iterable[str]):
        # TODO: Probably faster to use gather() here.
        for id_ in container_ids:
            container = self.aclient.containers.container(id_)

            # If the container is running, kill it before removing it
            # and remove anonymous volumes associated with the
            # container.
            await container.delete(force=True, v=True)

        await self.close_aclient()

    def remove_containers(self, container_ids: Iterable[str]):
        """Removes the given containers and removes associated volumes.

        If the container is running, then it is killed before removing
        it.

        Args:
            containers: An iterable of containers, where a container
                is given by its name or ID.

        """
        asyncio.run(self._remove_containers(container_ids))

    async def _run_container(self, name, config, use_name=False, detach=True):
        if use_name:
            container = await self.aclient.containers.run(name=name, config=config)
        else:
            container = await self.aclient.containers.run(config=config)

        stdout = None
        if not detach:
            await container.wait()
            stdout = await container.log(stdout=True)

        info = {
            "id": container.id,
            "stdout": stdout,
        }
        return name, info

    async def _run_containers(
        self, configs: Dict[str, Dict[str, Any]], use_name=False, detach=True
    ):
        stdouts = await asyncio.gather(
            *[
                self._run_container(name, config, use_name=use_name, detach=detach)
                for name, config in configs.items()
            ]
        )

        await self.close_aclient()

        return dict(stdouts)

    def run_containers(
        self, configs: Dict[str, Dict[str, Any]], use_name=False, detach=True
    ):
        """Runs the given collection of images.

        Args:
            configs: Configuration to start each container with.
                Example:
                    {
                      "orchest-api": {...}
                    }
            use_name: If True uses the keys of `configs` as the names
                for the Docker containers. Otherwise it lets Docker
                choose a name. NOTE: Name collissions will prevent
                containers from starting.

        """
        return asyncio.run(
            self._run_containers(configs, use_name=use_name, detach=detach)
        )

    def exec_run(self, container_id: str, cmd: Union[str, List[Any]]) -> int:
        """Returns the exit code of running a cmd inside a container.

        Making this function async (rough idea):
        ```python
        container = self.aclient.containers.container(container_id)

        # If the container is running, kill it before removing it
        # and remove anonymous volumes associated with the
        # container.
        exec = await container.exec(...)

        https://github.com/aio-libs/aiodocker/blob/master/aiodocker/execs.py#L69
        exec.start(...)

        # Not sure whether start has to be called before inspect
        https://github.com/aio-libs/aiodocker/blob/master/aiodocker/execs.py#L34
        res = exec.inspect(...)

        https://docs.docker.com/engine/api/v1.41/#operation/ExecInspect
        res["ExitCode"]
        ```
        """
        container = docker.models.containers.Container(
            attrs={"Id": container_id}, client=self.sclient
        )
        # Calling the lower level API as the following command gave
        # incorrect exit codes:
        # exit_code, _ = container.exec_run(cmd)
        resp = container.client.api.exec_create(
            container.id, "pg_isready --username postgres"
        )
        _ = container.client.api.exec_start(resp["Id"])
        exit_code = container.client.api.exec_inspect(resp["Id"])["ExitCode"]

        return exit_code


class OrchestResourceManager:
    orchest_images: List[str] = ORCHEST_IMAGES["all"]
    network: str = DOCKER_NETWORK

    def __init__(self):
        self.docker_client = DockerWrapper()

    def install_network(self) -> None:
        """Installs the Orchest Docker network."""
        # Don't install the network again if it is already installed
        # because that will create the another network with the same
        # name but with another ID. Thereby, breaking Orchest.
        try:
            is_installed = self.docker_client.is_network_installed(self.network)
        except docker.errors.APIError:
            # TODO: reraise the error but with a helpful message that
            # helps the user fix the issue.
            raise

        if not is_installed:
            # We only want to print this message to the user once. The
            # best bet is that if the Orchest network has not yet been
            # installed, then most likely the user has not seen this
            # message before.
            utils.echo(
                "Orchest sends anonymized telemetry to analytics.orchest.io."
                " To disable it, please refer to:",
                wrap=WRAP_LINES,
            )
            utils.echo(
                "\thttps://orchest.readthedocs.io/en/stable/user_guide/other.html#configuration"  # noqa: E501, W505
            )

            self.docker_client.install_network(self.network)

    def get_images(self, orchest_owned: bool = False) -> List[str]:
        """Returns all pulled images associated to Orchest.

        Args:
            orchest_owned: If True only returns the images owned by the
                Orchest organization, e.g. excluding "rabbitmq".

        """
        check_images = self.orchest_images
        if orchest_owned:
            check_images = [
                img for img in self.orchest_images if img.startswith("orchest")
            ]

        exists = self.docker_client.do_images_exist(check_images)

        # TODO: could make it into set as well as order is not important
        #       here.
        return [img for i, img in enumerate(check_images) if exists[i]]

    # TODO: this function might be a bit strange if it
    #       returns img names.
    def get_containers(
        self,
        state: Literal["all", "running", "exited"] = "running",
    ) -> Tuple[List[str], List[Optional[str]]]:
        """

        Args:
            state: The state of the container to be in in order for it
                to be returned.
        """
        return self.docker_client.get_containers(state=state, network=self.network)

    def get_env_build_imgs(self):
        return self.docker_client.list_image_ids(label="_orchest_project_uuid")

    def remove_env_build_imgs(self):
        env_build_imgs = self.get_env_build_imgs()
        self.docker_client.remove_images(env_build_imgs, force=True)


class OrchestApp:
    """...

    Attributes:
        on_start_images: Images to run when the app is started. The
            order states the order in which the images have to be
            started due to dependencies between them. A collection
            indicates that its contained images can be started
            asynchronously.

    """

    # postgres -> orchest-webserver, orchest-api, auth-server
    # rabbitmq -> celery-worker
    on_start_images: List[Set[str]] = [
        set(
            [
                "postgres:13.1",
                "orchest/file-manager:latest",
                "orchest/nginx-proxy:latest",
                "rabbitmq:3",
            ]
        ),
        set(
            [
                "orchest/orchest-api:latest",
                "orchest/orchest-webserver:latest",
                "orchest/celery-worker:latest",
                "orchest/auth-server:latest",
            ]
        ),
    ]

    def __init__(self):
        self.resource_manager = OrchestResourceManager()
        self.docker_client = DockerWrapper()

    def is_running(self, running_containers) -> bool:
        """Check whether Orchest is running"""

        # Don't count orchest-ctl when checking
        # whether Orchest is running.
        running_containers = [
            c for c in running_containers if c not in ["orchest/orchest-ctl:latest"]
        ]

        return len(running_containers) > 0

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
                wrap=WRAP_LINES,
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
        req_images: Set[str] = reduce(
            lambda x, y: x.union(y), self.on_start_images, set()
        )
        missing_images = req_images - set(pulled_images)

        if missing_images:
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
                wrap=WRAP_LINES,
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
        for i, to_start_imgs in enumerate(self.on_start_images):
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
                    "pg_isready -- username postgres",
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
        if not self.is_running(running_containers):
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

    def _updateserver(self):
        """Starts the update-server service."""
        logger.info("Starting Orchest update service...")

        config = {}
        container_config = spec.get_container_config("reg")
        config["update-server"] = container_config["update-server"]

        self.docker_client.run_containers(config, use_name=True, detach=True)

    def status(self):

        _, running_containers = self.resource_manager.get_containers(state="running")

        if not self.is_running(running_containers):
            utils.echo("Orchest is not running.")
            return

        # Minimal set of containers to be running for Orchest to be in
        # a valid state.
        valid_set: Set[str] = reduce(
            lambda x, y: x.union(y), self.on_start_images, set()
        )

        if valid_set - set(running_containers):
            utils.echo("Orchest is running, but has reached an invalid state. Run:")
            utils.echo("\torchest restart")
            logger.warning(
                "Orchest has reached an invalid state. Running containers:\n"
                + "\n".join(running_containers)
            )
        else:
            utils.echo("Orchest is running.")

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
        if self.is_running(running_containers):
            utils.echo("Using Orchest whilst updating is NOT recommended.")

        # Update the Orchest git repo to get the latest changes to the
        # "userdir/" structure.
        exit_code = utils.update_git_repo()
        if exit_code != 0:
            utils.echo("Cancelling update...")
            utils.echo(
                "It seems like you have unstaged changes in the 'orchest'"
                " repository. Please commit or stash them as 'orchest update'"
                " pulls the newest changes to the 'userdir/' using a rebase.",
                wrap=WRAP_LINES,
            )
            logger.error("Failed update due to unstaged changes.")
            return

        logger.info("Updating images:\n" + "\n".join(pulled_images))
        self.docker_client.pull_images(pulled_images, prog_bar=True, force=True)

        # Delete user-built environment images to avoid the issue of
        # having environments with mismatching Orchest SDK versions.
        logger.info("Deleting user-built environment images.")
        self.resource_manager.remove_env_build_imgs()

        # Restart the application in case the update-server invoked the
        # update, since the user called the update through the UI and
        # most likely does not want to invoke "orchest restart"
        # manually.
        if mode == "web":
            utils.echo("Update completed.")
            self.restart()
            return

        # Let the user know they need to restart the application for the
        # changes to take effect. NOTE: otherwise Orchest might also be
        # running a mix of containers on different versions.
        utils.echo("Don't forget to restart Orchest for the changes to take effect:")
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
        pulled_images = self.resource_manager.get_images(orchest_owned=True)

        configs = {}
        for img in pulled_images:
            configs[img] = {
                "Image": img,
                "Entrypoint": ["printenv", "ORCHEST_VERSION"],
            }

        stdouts = self.docker_client.run_containers(configs, detach=False)
        stdout_values = set()
        for img, info in stdouts.items():
            stdout = info["stdout"]
            # stdout = ['v0.4.1-58-g3f4bc64\n']
            stdout = stdout[0].rstrip()
            stdout_values.add(stdout)
            utils.echo(f"{img:<44}: {stdout}")

        # If not all versions are the same.
        if len(stdout_values) > 1:
            utils.echo(
                "Not all containers are running on the same version of Orchest, which"
                " can lead to the application crashing. You can fix this by running:",
                wrap=WRAP_LINES,
            )
            utils.echo("\torchest update")
            utils.echo("To get all containers on the same version again.")


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
        for lang, imgs in language_images.items():
            required_images += language_images[lang]
    elif language is not None:
        required_images += language_images[language]

    if gpu:
        required_images += gpu_images["language"]

    return required_images
