import asyncio
import logging
from typing import Any, Dict, Iterable, List, Literal, Mapping, Optional, Tuple, Union

import aiodocker
import docker
from docker.client import DockerClient
from tqdm.asyncio import tqdm

from _orchest.internals import config as _config
from app import utils
from app.config import ORCHEST_IMAGES, WRAP_LINES

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

    async def _list_images(
        self,
        all: bool = False,
        label: Optional[str] = None,
        dangling: Optional[bool] = None,
    ) -> List[str]:

        kwargs = {
            "all": all,
        }

        if label is not None:
            kwargs["filters"] = {"label": [label]}

        images = await self.aclient.images.list(**kwargs)

        await self.close_aclient()

        # Seems like the "dangling" argument in filters cannot be used
        # in aiodocker, same for the kwarg "name".
        if dangling is not None:
            images = [img for img in images if dangling == utils.is_dangling(img)]
        return images

    def list_images(
        self,
        all: bool = False,
        label: Optional[str] = None,
        dangling: Optional[bool] = None,
    ) -> Mapping:
        return asyncio.run(self._list_images(all=all, label=label, dangling=dangling))

    def list_image_ids(
        self,
        all: bool = False,
        label: Optional[str] = None,
        dangling: Optional[bool] = None,
    ) -> List[str]:
        imgs = asyncio.run(self._list_images(all=all, label=label, dangling=dangling))
        return [img["Id"] for img in imgs]

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

    async def _tag_image(self, name: str, repo: str, *, tag: Optional[str] = None):
        await self.aclient.images.tag(name=name, repo=repo, tag=tag)
        await self.close_aclient()

    def tag_image(self, name: str, repo: str, *, tag: Optional[str] = None):
        asyncio.run(self._tag_image(name=name, repo=repo, tag=tag))

    async def _get_containers(
        self,
        state: Literal["all", "running", "exited"] = "running",
        network: Optional[str] = None,
        full_info: bool = False,
        label: Optional[str] = None,
    ) -> Tuple[List[str], List[Optional[str]]]:
        all_ = True if state in ["all", "exited"] else False

        filters = {}
        if network is not None:
            filters["network"] = [network]
        if label is not None:
            filters["label"] = [label]

        containers = await self.aclient.containers.list(all=all_, filters=filters)
        await self.close_aclient()

        info = []
        img_names = []
        for c in containers:
            if state == "exited":
                if c._container.get("State") != "running":
                    img_names.append(c._container.get("Image"))
                    info.append(c._container if full_info else c.id)
            else:
                img_names.append(c._container.get("Image"))
                info.append(c._container if full_info else c.id)

        return info, img_names

    def get_containers(
        self,
        state: Literal["all", "running", "exited"] = "running",
        network: Optional[str] = None,
        full_info: bool = False,
        label: Optional[str] = None,
    ) -> Tuple[List[str], List[Optional[str]]]:
        """Returns runnings containers (on a network).

        Args:
            state: The state of the container to be in in order for it
                to be returned.
            network: The network on which to filter the containers.
            full_info: If True returns the complete info for each
                container, else only the id.
            label: Label through which to filter containers, can be None
                , a tag key or of the form key=value.

        Returns:
            (container_ids, img_names) in respective order. Where the
            img_names are the names of the images underlying of the
            containers.

        """
        return asyncio.run(
            self._get_containers(
                state=state, network=network, full_info=full_info, label=label
            )
        )

    async def _remove_containers(self, container_ids: Iterable[str]):
        async def remove_container(id_: str) -> None:
            container = self.aclient.containers.container(id_)

            try:
                # Might raise a 409
                # If the container is running, kill it before removing
                # it and remove anonymous volumes associated with the
                # container.
                await container.delete(force=True, v=True)

                # Might raise a 404
                # Block until the container is deleted.
                await container.wait(condition="removed")
            except aiodocker.exceptions.DockerError as de:
                # 404
                # The container was removed so fast that the wait
                # condition was unable to find the container.
                # 409 + already in progress check
                # The container is already being removed. This can
                # happen if a container is being removed after a step
                # has completed and Orchest is stopped.
                if not (
                    de.status == 404
                    or (de.status == 409 and "is already in progress" in de.message)
                ):
                    raise de

        await asyncio.gather(*[remove_container(id_) for id_ in container_ids])
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

    def get_container(self, id_or_name: str):
        return self.sclient.containers.get(id_or_name)

    async def _exec_run(self, container_id: str, cmd) -> int:
        """Returns the exit code of running a cmd inside a container."""

        container = self.aclient.containers.container(container_id)

        exec = await container.exec(stdout=True, stderr=True, stdin=True, cmd=cmd)

        await exec.start(detach=True)

        exit_code = None
        while exit_code is None:
            exit_code = (await exec.inspect())["ExitCode"]
            await asyncio.sleep(0.1)

        return exit_code

    async def _exec_runs(self, cmds) -> List[int]:
        res = await asyncio.gather(*[self._exec_run(id, cmd) for id, cmd in cmds])
        await self.close_aclient()
        return res

    def exec_runs(self, cmds: List[Tuple[str, Union[str, List[str]]]]) -> List[int]:
        """Returns the exit codes of running cmds in containers.

        Args:
            cmds: A list of pairs where, for each pair, the first
                element is the container id, while the second element is
                the command to run.

        Returns:
            List of exit codes of the commands that have been run.
        """
        return asyncio.run(self._exec_runs(cmds))

    async def _copy_file_from_container(
        self, container_id: str, from_path: str, to_path: str
    ) -> None:
        container = self.aclient.containers.container(container_id)

        tar_file = await container.get_archive(from_path)
        file_name = from_path if "/" not in from_path else from_path.split("/")[-1]
        file = tar_file.extractfile(file_name)

        with open(to_path, "wb") as dest_file:
            dest_file.write(file.read())
        tar_file.close()

    async def _copy_file_from_containers(
        self, files: List[Tuple[str, str, str]]
    ) -> None:
        await asyncio.gather(
            *[
                self._copy_file_from_container(id, from_path, to_path)
                for (id, from_path, to_path) in files
            ]
        )
        await self.close_aclient()

    def copy_files_from_containers(self, files: List[Tuple[str, str, str]]) -> None:
        """Copy files from containers.

        Args:
            files: A list of triples where, for each triple, the first
                element is the container id, the second element is a
                path in the container (to copy from) and the third
                element is a path in the fs (to copy to).
        """
        asyncio.run(self._copy_file_from_containers(files))


class OrchestResourceManager:
    orchest_images: List[str] = ORCHEST_IMAGES["all"]
    network: str = _config.DOCKER_NETWORK

    def __init__(self):
        self.docker_client = DockerWrapper()

    def is_network_installed(self):
        return self.docker_client.is_network_installed(self.network)

    def install_network(self) -> None:
        """Installs the Orchest Docker network."""
        # Don't install the network again if it is already installed
        # because that will create the another network with the same
        # name but with another ID. Thereby, breaking Orchest.
        try:
            is_installed = self.is_network_installed()
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
                "Orchest sends anonymized telemetry to analytics.orchestapp.com."
                " To disable it, please refer to:",
            )
            utils.echo(
                "\thttps://orchest.readthedocs.io/en/stable/user_guide/other.html#configuration",  # noqa: E501, W505
                wrap=100,
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
        full_info: bool = False,
        label: Optional[str] = None,
    ) -> Tuple[List[str], List[Optional[str]]]:
        """

        Args:
            state: The state of the container to be in in order for it
                to be returned.
            full_info: If True returns the complete info for each
                container, else only the id.
        """
        return self.docker_client.get_containers(
            state=state, network=self.network, full_info=full_info, label=label
        )

    def get_env_build_imgs(self):
        return self.docker_client.list_images(
            label="_orchest_env_build_is_intermediate=0"
        )

    def get_jupyter_build_imgs(self):
        return self.docker_client.list_image_ids(
            label="_orchest_jupyter_build_task_uuid"
        )

    def get_orchest_dangling_imgs(self):
        return self.docker_client.list_image_ids(
            label="maintainer=Orchest B.V. https://www.orchest.io", dangling=True
        )

    def tag_environment_images_for_removal(self):
        env_build_imgs = self.get_env_build_imgs()
        for img in env_build_imgs:
            labels = img.get("Labels", {})
            pr_uuid = labels.get("_orchest_project_uuid")
            env_uuid = labels.get("_orchest_environment_uuid")
            build_uuid = labels.get("_orchest_env_build_task_uuid")

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
                or f"{env_name}:latest" not in img["RepoTags"]
                or
                # Note the lack of a "not". This is to avoid trying to
                # tag the same image multiple times.
                f"{removal_name}:latest" in img["RepoTags"]
            ):
                continue

            self.docker_client.tag_image(env_name, removal_name)

    def remove_jupyter_build_imgs(self):
        jupyter_build_imgs = self.get_jupyter_build_imgs()
        self.docker_client.remove_images(jupyter_build_imgs, force=True)

    def remove_orchest_dangling_imgs(self):
        """Remove Orchest dangling images that are not in use."""
        orchest_dangling_imgs = set(self.get_orchest_dangling_imgs())

        # This will pick up both orchest-ctl (which is not in the
        # orchest network) and the other orchest containers.
        containers, _ = self.docker_client.get_containers(full_info=True, network=None)

        # Do not try to delete images that are in use.
        images_in_use = {c["ImageID"] for c in containers}
        orchest_dangling_imgs = orchest_dangling_imgs - images_in_use

        self.docker_client.remove_images(orchest_dangling_imgs, force=True)

    def containers_version(self):
        pulled_images = self.get_images(orchest_owned=True)
        configs = {}
        for img in pulled_images:
            configs[img] = {
                "Image": img,
                "Entrypoint": ["printenv", "ORCHEST_VERSION"],
            }

        stdouts = self.docker_client.run_containers(configs, detach=False)
        for img in stdouts.keys():
            stdouts[img] = stdouts[img]["stdout"][0].rstrip()
        return stdouts
