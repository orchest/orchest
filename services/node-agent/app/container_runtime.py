import asyncio
import json
import logging
import os
import time
from asyncio import subprocess
from enum import Enum
from typing import List, Optional, Tuple

import aiodocker

from _orchest.internals import config as _config


class RuntimeType(Enum):
    Docker = "docker"
    Containerd = "containerd"


class ImagePushError(Exception):
    ...


class ContainerRuntime(object):
    def __init__(self) -> None:

        self.container_runtime = RuntimeType(os.getenv("CONTAINER_RUNTIME"))
        self.container_runtime_socket = os.getenv("CONTAINER_RUNTIME_SOCKET")
        self.logger = logging.getLogger("CONTAINER_RUNTIME_CLI")
        self.logger.setLevel(os.getenv("CONTAINER_RUNTIME_LOG_LEVEL", "INFO"))

        # Container to make sure that images that are already being
        # pulled are not pulled concurrently again.
        self._curr_pulling_imgs = set()

        self._aclient: Optional[aiodocker.Docker] = None

    @property
    def aclient(self):
        if self._aclient is None:
            self._aclient = aiodocker.Docker()

        return self._aclient

    async def close(self):
        if self.container_runtime == RuntimeType.Docker:
            if self._aclient is not None:
                await self._aclient.close()
                self._aclient = None
        elif self.container_runtime == RuntimeType.Containerd:
            pass

    async def execute_cmd(self, **kwargs) -> Tuple[bool, Optional[str], Optional[str]]:
        """Run command in subprocess.

        Returns:
            Tuple of result and stdout of the command, the result is
            True if the command where succfull.
        """
        process = await asyncio.create_subprocess_shell(
            **kwargs, stdin=subprocess.PIPE, stdout=subprocess.PIPE
        )

        # Wait for the subprocess to finish
        returncode = await process.wait()
        stdout, stderr = await process.communicate()

        if stdout is not None:
            stdout = stdout.decode().strip()
        if stderr is not None:
            stderr = stderr.decode().strip()

        self.logger.debug(
            f"excuted a command with returncide: {returncode} command: {kwargs}"
        )

        return returncode == 0, stdout, stderr

    async def image_exists(self, image_name: str) -> bool:
        """Checks for the existence of the named image using
        the configured container runtime.

        Args:
            image_name: The name of the image to be checked.

        Returns:
            True if exist locally, False otherwise.

        """
        result = True

        if self.container_runtime == RuntimeType.Docker:
            try:
                await self.aclient.images.inspect(image_name)
            except aiodocker.DockerError:
                result = False
        elif self.container_runtime == RuntimeType.Containerd:
            cmd = (
                f"crictl -r unix://{self.container_runtime_socket} "
                f"inspecti -q {image_name}"
            )
            result, _, _ = await self.execute_cmd(cmd=cmd)

        self.logger.debug(
            f"Checked existence of image '{image_name}': exists = {result}"
        )
        return result

    async def download_image(self, image_name: str) -> bool:
        """Downloads (pulls) the named image.

        Args:
            image_name: The name of the image for downloading.

        Returns:
            True if download was successful, False otherwise.

        """
        result = True
        t0 = time.time()

        self._curr_pulling_imgs.add(image_name)
        if self.container_runtime == RuntimeType.Docker:
            try:
                await self.aclient.images.pull(image_name)
            except aiodocker.DockerError:
                result = False
            finally:
                self._curr_pulling_imgs.remove(image_name)
        elif self.container_runtime == RuntimeType.Containerd:
            cmd = (
                f"ctr -n k8s.io -a {self.container_runtime_socket} "
                f"i pull {image_name} --skip-verify "
            )
            result, _, _ = await self.execute_cmd(cmd=cmd)

        self._curr_pulling_imgs.remove(image_name)

        t1 = time.time()
        if result is True:
            self.logger.info(f"Pulled image '{image_name}' in {(t1 - t0):.3f} secs.")

        return result

    async def list_images(self) -> List[str]:
        """Lists all the images present on the node.

        Returns:
            Yields the name of the images on the node.

        """
        image_names = []
        if self.container_runtime == RuntimeType.Docker:
            try:
                filters = {
                    "label": [
                        f"maintainer={_config.ORCHEST_MAINTAINER_LABEL}",
                    ]
                }
                for img in await self.aclient.images.list(filters=filters):
                    names = img.get("RepoTags")
                    # Unfortunately RepoTags is mapped to None
                    # instead of not being there in some cases.
                    names = names if names is not None else []
                    for name in names:
                        image_names.append(name)
            except aiodocker.DockerError:
                pass
        elif self.container_runtime == RuntimeType.Containerd:
            cmd = f"crictl -r unix://{self.container_runtime_socket} images -o=json"
            result, stdout, _ = await self.execute_cmd(cmd=cmd)
            if result is True:
                images = json.loads(stdout)["images"]
                for img in images:
                    names = img["repoTags"]
                    names = names if names is not None else []
                    for name in names:
                        image_names.append(name)

        return image_names

    async def delete_image(self, image_name: str) -> bool:
        result = True

        if self.container_runtime == RuntimeType.Docker:
            try:
                await self.aclient.images.delete(image_name, force=True)
            except aiodocker.DockerError:
                result = False
        elif self.container_runtime == RuntimeType.Containerd:
            cmd = f"crictl -r unix://{self.container_runtime_socket} rmi {image_name}"
            result, _, _ = await self.execute_cmd(cmd=cmd)

        self.logger.debug(f"Image is deleted: '{image_name}'")
        return result

    async def push_image(self, image_name: str) -> None:
        self.logger.debug(f"Pushing: '{image_name}'")
        if self.container_runtime == RuntimeType.Docker:
            try:
                await self.aclient.images.push(name=image_name)
            except aiodocker.DockerError as e:
                raise ImagePushError(str(e))

        elif self.container_runtime == RuntimeType.Containerd:
            # ENV_PERF_TODO: test this.
            cmd = (
                f"ctr -n k8s.io -a {self.container_runtime_socket} "
                f"i push {image_name} --skip-verify "
            )
            success, stdout, stderr = await self.execute_cmd(cmd=cmd)
            if not success:
                raise ImagePushError(f"STDOUT: {stdout}\nSTDERR: {stderr}")
        # ENV_PERF_TODO:
        # Cover case of docker failing to push because of missing
        # certificates , see the edge case in pull_image.sh. This will
        # likely involve using a third party tool like buildah to push
        # things separately.
        self.logger.debug(f"Image pushed: '{image_name}'")
