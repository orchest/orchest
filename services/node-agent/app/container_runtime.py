import asyncio
import json
import logging
import time
from enum import Enum
from typing import List, Optional

import aiodocker

from _orchest.internals import config as _config


class RuntimeType(Enum):
    Docker = "docker"
    Containerd = "containerd"


class ContainerRuntime(object):
    def __init__(
        self,
        container_runtime: str,
        container_runtime_socket: str,
        runtime_log_level: str,
    ) -> None:

        self.container_runtime = container_runtime
        self.container_runtime_socket = container_runtime_socket
        self.logger = logging.getLogger("RUNTIME_CLI")
        self.logger.setLevel(runtime_log_level)

        # Container to make sure that images that are already being
        # pulled are not pulled concurrently again.
        self._curr_pulling_imgs = set()

        self._aclient: Optional[aiodocker.Docker] = None

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

    async def execute_cmd(self, args: List[str]) -> bool:
        """Run command in subprocess.

        Example from:
            http://asyncio.readthedocs.io/en/latest/subprocess.html
        """
        process = await asyncio.create_subprocess_exec(
            *args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )

        # Wait for the subprocess to finish
        stdout, stderr = await process.communicate()

        if process.returncode == 0:
            self.logger.debug(
                "Done: %s, pid=%s, result: %s"
                % (args, process.pid, stdout.decode().strip()),
                flush=True,
            )
        else:
            self.logger.debug(
                "Failed: %s, pid=%s, result: %s"
                % (args, process.pid, stderr.decode().strip()),
                flush=True,
            )

        # Result
        result = stdout.decode().strip()

        # Return stdout
        return result

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
                await self.aclient().images.inspect(image_name)
            except aiodocker.DockerError:
                result = False
        elif self.container_runtime == RuntimeType.Containerd:
            args = [
                "crictl",
                "-r",
                self.container_runtime_socket,
                "inspecti",
                "-q",
                image_name,
            ]
            result = await self.execute_cmd(args)

        self.logger.debug(
            f"Checked existence of image '{image_name} '" f"exists = {result}"
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

        if self.container_runtime == RuntimeType.Docker:
            try:
                self._curr_pulling_imgs.add(image_name)
                await self.aclient().images.pull(image_name)
            except aiodocker.DockerError:
                result = False
            finally:
                self._curr_pulling_imgs.remove(image_name)
        elif self.container_runtime == RuntimeType.Containerd:
            args = ["crictl", "-r", self.container_runtime_socket, "pull", image_name]
            result = await self.execute_cmd(args)

        t1 = time.time()
        if result is True:
            self.logger.info(f"Pulled image '{image_name}' in {(t1 - t0):.3f} secs.")
        return result

    async def list_images(self):
        """Lists all the images present on the node.

        Returns:
            Yields the name of the images on the node.

        """
        if self.container_runtime == RuntimeType.Docker:
            try:
                filters = {
                    "label": [
                        f"maintainer={_config.ORCHEST_MAINTAINER_LABEL}",
                    ]
                }
                for img in await self.aclient().images.list(filters=filters):
                    names = img.get("RepoTags")
                    # Unfortunately RepoTags is mapped to None
                    # instead of not being there in some cases.
                    names = names if names is not None else []
                    for name in names:
                        yield name
            except aiodocker.DockerError:
                pass
        elif self.container_runtime == RuntimeType.Containerd:
            args = ["crictl", "-r", self.container_runtime_socket, "images", "-o=json"]
            result = await self.execute_cmd(args)
            try:
                images = json.loads(result)["images"]
                for img in images:
                    names = img["repoTags"]
                    names = names if names is not None else []
                    for name in names:
                        yield name
            except Exception:
                pass

    async def delete_image(self, image_name: str) -> bool:
        result = True

        if self.container_runtime == RuntimeType.Docker:
            try:
                await self.aclient().images.delete(image_name, force=True)
            except aiodocker.DockerError:
                result = False
        elif self.container_runtime == RuntimeType.Containerd:
            args = [
                "crictl",
                "-r",
                self.container_runtime_socket,
                "rmi",
                image_name,
            ]
            result = await self.execute_cmd(args)

        self.logger.debug(f"Image is deleted: '{image_name} '")
        return result
