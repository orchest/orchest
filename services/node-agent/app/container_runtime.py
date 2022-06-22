import asyncio
import logging
import time
from enum import Enum
from typing import List, Optional

import aiodocker


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
        else:  # invalid container runtime
            self.logger.error(
                f"Invalid container runtime detected: '{self.container_runtime}'!"
            )
            result = False

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
        else:  # invalid container runtime
            self.logger.error(
                f"Invalid container runtime detected: '{self.container_runtime}'!"
            )
            result = False

        t1 = time.time()
        if result is True:
            self.logger.info(f"Pulled image '{image_name}' in {(t1 - t0):.3f} secs.")
        return result
