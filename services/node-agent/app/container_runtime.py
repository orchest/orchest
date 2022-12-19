import asyncio
import json
import logging
import os
import time
from asyncio import subprocess
from enum import Enum
from typing import Any, Dict, Iterable, List, Optional, Tuple

import aiodocker


class RuntimeType(Enum):
    Docker = "docker"
    Containerd = "containerd"


class ImagePushError(Exception):
    ...


class ImagePullError(Exception):
    ...


class OngoingPushForSameImage(ImagePushError):
    ...


class OngoingPullForSameImage(ImagePullError):
    ...


def _failed_to_reach_registry(aiodocker_resp=Iterable[Dict[str, Any]]) -> bool:
    for item in aiodocker_resp:
        if isinstance(item, dict) and (
            # Both cases have been observed.
            "deadline exceeded" in item.get("error", "").lower()
            or "timeout exceeded" in item.get("error", "").lower()
        ):
            return True
    return False


class ContainerRuntime(object):
    """Class to interface the underlying container runtime.

    This class is meant to be used by a single threaded async
    application. Given the sets used to keep track of pushes and pulls
    this class can't be used in a multi process/thread context.
    """

    def __init__(self) -> None:

        self.container_runtime = RuntimeType(os.getenv("CONTAINER_RUNTIME"))
        self.container_runtime_socket = os.getenv("CONTAINER_RUNTIME_SOCKET")
        self.logger = logging.getLogger("CONTAINER_RUNTIME_CLI")
        self.logger.setLevel(os.getenv("CONTAINER_RUNTIME_LOG_LEVEL", "INFO"))

        # Avoid concurrent pushes/pulls of the same image.
        self._ongoing_pushes = set()
        self._ongoing_pulls = set()

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
            True if the command was successful.
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
            f"Executed a command with return code: {returncode} command: {kwargs}"
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

    async def _pull_image_for_docker_with_buildah(self, image_name: str) -> bool:
        """Pulls an image in the docker runtime using buildah.

        Necessary when docker refuses to pull from insecure registries.
        Note that this is going to be much slower and will temporarily
        use storage.

        Note that this has the open issue of leaving dangling storage in
        cases where the logic would be interrupted before being able to
        cleanup the temporarily stored image. For example if the
        node-agent pod restarts during that moment, and the image is not
        considered for pulling anymore or if, somehow, this function is
        not called because docker managed to pull.
        """
        self.logger.info(f"Attempting to pull {image_name} with buildah.")
        cmd = (
            f"buildah pull --tls-verify=false {image_name} && "
            f"buildah push --disable-compression '{image_name}' "
            f"docker-daemon:{image_name} && "
            f"buildah rmi {image_name} && buildah rmi -p"
        )
        success, _, _ = await self.execute_cmd(cmd=cmd)
        return success

    async def pull_image(self, image_name: str) -> bool:
        """Pulls the named image.

        Args:
            image_name: The name of the image to pull.

        Raises:
            OngoingPullForSameImage: If a pull for the same image is
                already ongoing.

        Returns:
            True if the pull was successful, False otherwise.

        """
        if image_name in self._ongoing_pulls:
            raise OngoingPullForSameImage()
        self._ongoing_pulls.add(image_name)

        t0 = time.time()
        try:
            result = await self._pull_image(image_name)
        finally:
            self._ongoing_pulls.remove(image_name)

        t1 = time.time()
        if result:
            self.logger.info(f"Pulled image '{image_name}' in {(t1 - t0):.3f} secs.")
        return result

    async def _pull_image(self, image_name: str) -> bool:

        result = True

        if self.container_runtime == RuntimeType.Docker:
            try:
                await self.aclient.images.pull(image_name)
            except aiodocker.DockerError as e:
                result = False
                # e.status (status code) will be 500 for different
                # failures , so we resort to partially matching the
                # message. The message will look like the following for
                # the case we are interested in: 'get "<url>": x509:
                # certificate signed by unknown authority.
                if (
                    "certificate" in e.message.lower()
                    or
                    # Happens on docker for desktop where the container
                    # runtime can't get in touch with the registry
                    # service through its ip.
                    "timeout exceeded" in e.message.lower()
                ):
                    result = await self._pull_image_for_docker_with_buildah(image_name)
        elif self.container_runtime == RuntimeType.Containerd:
            cmd = (
                f"ctr -n k8s.io -a {self.container_runtime_socket} "
                f"i pull {image_name} --skip-verify "
            )
            result, _, _ = await self.execute_cmd(cmd=cmd)

        return result

    async def list_images(self) -> List[str]:
        """Lists all the images present on the node.

        Returns:
            Yields the name of the images on the node.

        """
        image_names = []
        if self.container_runtime == RuntimeType.Docker:
            try:
                for img in await self.aclient.images.list():
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

    async def _push_image_for_docker_with_buildah(self, image_name: str) -> bool:
        """Push an img from docker runtime to the registry with buildah.

        See _pull_image_for_docker_with_buildah for more details. The
        issue about temporary storage also applies.
        """
        self.logger.info(f"Attempting to push {image_name} with buildah.")
        cmd = (
            f"buildah pull docker-daemon:{image_name} && "
            f"buildah push --tls-verify=false '{image_name}' && "
            f"buildah rmi {image_name} && buildah rmi -p"
        )
        success, _, _ = await self.execute_cmd(cmd=cmd)
        return success

    async def push_image(self, image_name: str) -> None:
        """Pushes an image.

        Raises:
            ImagePushError: If the image push failed.
            OngoingPushForSameImage: If a push for the same image is
                already ongoing.

        """
        if image_name in self._ongoing_pushes:
            raise OngoingPushForSameImage()
        self._ongoing_pushes.add(image_name)
        try:
            await self._push_image(image_name)
        finally:
            self._ongoing_pushes.remove(image_name)

    async def _push_image(self, image_name: str) -> None:
        self.logger.debug(f"Pushing: '{image_name}'")
        if self.container_runtime == RuntimeType.Docker:
            try:
                aiodocker_resp = await self.aclient.images.push(name=image_name)
                # Happens on docker for desktop where the container
                # runtime can't get in touch with the registry service
                # through its ip.
                if _failed_to_reach_registry(aiodocker_resp):
                    self.logger.warning(
                        "Failed to reach the registry, trying push through buildah."
                    )
                    success = await self._push_image_for_docker_with_buildah(image_name)
                    if not success:
                        raise ImagePushError(str(aiodocker_resp))
            except aiodocker.DockerError as e:
                success = False
                # e.status (status code) will be 500 for different
                # failures , so we resort to partially matching the
                # message. The message will look like the following for
                # the case we are interested in:
                # 'get "<url>": x509: certificate signed by unknown
                # authority.
                if "certificate" in e.message.lower():
                    success = await self._push_image_for_docker_with_buildah(image_name)

                if not success:
                    raise ImagePushError(str(e))
        elif self.container_runtime == RuntimeType.Containerd:
            cmd = (
                f"ctr -n k8s.io -a {self.container_runtime_socket} "
                f"i push {image_name} --skip-verify "
            )
            success, stdout, stderr = await self.execute_cmd(cmd=cmd)
            if not success:
                raise ImagePushError(f"STDOUT: {stdout}\nSTDERR: {stderr}")
        self.logger.debug(f"Image pushed: '{image_name}'")
