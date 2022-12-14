import asyncio
import logging
from enum import Enum

import aiohttp
from container_runtime import ContainerRuntime, OngoingPullForSameImage

from _orchest.internals import config as _config
from _orchest.internals import utils as _utils
from config import CONFIG_CLASS


class Policy(Enum):
    IfNotPresent = "IfNotPresent"
    Always = "Always"


async def _notify_orchest_api_of_env_image_pull(
    session: aiohttp.ClientSession, image: str
) -> None:
    proj_uuid, env_uuid, tag = _utils.env_image_name_to_proj_uuid_env_uuid_tag(image)
    if tag is None:
        raise ValueError(f"Unexpected image without tag: {image}.")
    endpoint = (
        f"http://orchest-api/api/environment-images/{proj_uuid}/{env_uuid}/{tag}/"
        f"node/{CONFIG_CLASS.CLUSTER_NODE}"
    )
    async with session.put(endpoint) as response:
        if response.status != 200:
            raise Exception(f"Failed to PUT node pull of {image} to the orchest-api.")


async def _notify_orchest_api_of_jupyter_image_pull(
    session: aiohttp.ClientSession, image: str
) -> None:
    tag = _utils.jupyter_image_name_to_tag(image)
    endpoint = (
        f"http://orchest-api/api/ctl/jupyter-images/{tag}/node/"
        f"{CONFIG_CLASS.CLUSTER_NODE}"
    )
    if tag is None:
        raise ValueError(f"Unexpected image without tag: {image}.")

    async with session.put(endpoint) as response:
        if response.status != 200:
            raise Exception(f"Failed to PUT node pull of {image} to the orchest-api.")


class ImagePuller(object):
    def __init__(
        self,
        image_puller_interval: int,
        image_puller_policy: Policy,
        image_puller_retries: int,
        image_puller_log_level: str,
        image_puller_threadiness: int,
        orchest_api_host: str,
    ) -> None:

        """ImagePuller is started is responsible for pulling the
        provided list of images based on the configuration. based
        on the policy, it decides wther to check for the existance
        of the images on node or not.

         Args:
            image_puller_interval (int): ImagePuller tries to pull
                the image, then waits the interval number of seconds
                and perform the operation again.
            image_puller_policy (Policy): If the policy is
                `IfNotPresent` the set of pulled image names is first
                checked for existance, and pulls otherwise.
            image_puller_log_level (str): The log level of the component
            orchest_api_host (str): The orchest-api url to be used for
                fetching image names
        """

        self.interval = image_puller_interval
        self.policy = image_puller_policy
        self.num_retries = image_puller_retries
        self.threadiness = image_puller_threadiness
        self.orchest_api_host = orchest_api_host
        self.container_runtime = ContainerRuntime()
        self.logger = logging.getLogger("IMAGE_PULLER")
        self.logger.setLevel(image_puller_log_level)

    async def _enqueue_pre_pull_orchest_images(
        self, session: aiohttp.ClientSession, queue: asyncio.Queue
    ):
        endpoint = f"{self.orchest_api_host}/api/ctl/orchest-images-to-pre-pull"
        async with session.get(endpoint) as response:
            response_json = await response.json()
            for image_name in response_json["pre_pull_images"]:
                await queue.put((image_name, False))

    async def _enqueue_active_environment_images(
        self, session: aiohttp.ClientSession, queue: asyncio.Queue
    ):
        endpoint = (
            f"{self.orchest_api_host}/api/environment-images/active"
            "?stored_in_registry=true"
        )
        async with session.get(endpoint) as response:
            response_json = await response.json()
            active_images = response_json["active_environment_images"]

        # Since k8s GC could delete the image from the node we want the
        # image puller to continuously try to pull all active images, at
        # the same time, we don't want to have it notify the orchest-api
        # for every image it (attempts to) pull, but only about the ones
        # the orchest-api believe are not on the node.
        endpoint = (
            f"{self.orchest_api_host}/api/environment-images/active"
            f"?stored_in_registry=true&not_in_node={CONFIG_CLASS.CLUSTER_NODE}"
        )
        async with session.get(endpoint) as response:
            response_json = await response.json()
            images_to_notify_api_about_pull = set(
                response_json["active_environment_images"]
            )

        for image in active_images:
            await queue.put((image, image in images_to_notify_api_about_pull))

    async def _enqueue_active_jupyter_images(
        self, session: aiohttp.ClientSession, queue: asyncio.Queue
    ):
        endpoint = (
            f"{self.orchest_api_host}/api/ctl/active-custom-jupyter-images"
            "?stored_in_registry=true"
        )
        async with session.get(endpoint) as response:
            response_json = await response.json()
            active_images = response_json["active_custom_jupyter_images"]

        endpoint = (
            f"{self.orchest_api_host}/api/ctl/active-custom-jupyter-images"
            f"?stored_in_registry=true&not_in_node={CONFIG_CLASS.CLUSTER_NODE}"
        )
        async with session.get(endpoint) as response:
            response_json = await response.json()
            images_to_notify_api_about_pull = set(
                response_json["active_custom_jupyter_images"]
            )

        for image in active_images:
            await queue.put((image, image in images_to_notify_api_about_pull))

    async def get_active_images_to_pull(self, queue: asyncio.Queue):
        """Fetches the image names by calling following endpoints
        of the orchest-api.
            1. /ctl/orchest-images-to-pre-pull
            2. /ctl/active-custom-jupyter-images
            3. /environment-images/active
        Args:
            queue: The queue to put the image names to, the queue will
            be consumed by puller tasks.

        """

        async with aiohttp.ClientSession(trust_env=True) as session:
            while True:
                try:
                    await self._enqueue_active_environment_images(session, queue)
                    await self._enqueue_active_jupyter_images(session, queue)
                    await self._enqueue_pre_pull_orchest_images(session, queue)
                except Exception as ex:
                    self.logger.error(
                        f"Attempt '{self.interval}' to get active images"
                        f"encountered an exception. Exception was: {ex}."
                    )
                await asyncio.sleep(self.interval)

    async def pull_image(self, queue: asyncio.Queue):
        """Pulls the image.

        If the policy is `IfNotPresent` the set of pulled image names
        is checked and, if present, the method returns. Otherwise, the
        pull attempt is made and the set of pulled images is updated,
        when successful.

        Args:
            queue: The queue to get the image name from.

        """

        while True:
            image_name, should_notify_orchest_api = await queue.get()

            should_pull = self.policy == Policy.Always or (
                self.policy == Policy.IfNotPresent
                and not await self.container_runtime.image_exists(image_name)
            )

            for retry in range(self.num_retries):
                try:
                    if should_pull:
                        self.logger.info(f"Pulling image '{image_name}'...")
                        pulled_successfully = await self.container_runtime.pull_image(
                            image_name
                        )

                    # We might need to notify the orchest-api without
                    # having pulled the image if, for example, the image
                    # has already been pulled by other means, e.g. by a
                    # pod using the image which was started on this
                    # node.
                    should_notify_orchest_api = should_notify_orchest_api and (
                        not should_pull or pulled_successfully
                    )
                    if should_notify_orchest_api:
                        async with aiohttp.ClientSession(trust_env=True) as session:
                            await self.notify_orchest_api_of_image_pull(
                                session, image_name
                            )
                        self.logger.info(
                            f"Notified orchest-api of pull of '{image_name}'"
                        )
                    if should_pull:
                        if pulled_successfully:
                            self.logger.info(f"Image '{image_name}' was pulled.")
                            break
                        else:
                            self.logger.warning(f"Image '{image_name}' was not pulled!")
                    else:
                        break
                except OngoingPullForSameImage:
                    self.logger.info(
                        f"{image_name} is already being pulled, skipping task."
                    )
                    break
                except Exception as ex:
                    self.logger.warning(
                        f"Attempt {retry} to pull image '{image_name}' and notify the "
                        "orchest-api failed with exception - retrying. "
                        f"Exception was: {ex}."
                    )

            queue.task_done()

    async def notify_orchest_api_of_image_pull(
        self, session: aiohttp.ClientSession, image: str
    ) -> None:
        if "orchest-env" in image:
            await _notify_orchest_api_of_env_image_pull(session, image)
        elif _config.JUPYTER_IMAGE_NAME in image:
            await _notify_orchest_api_of_jupyter_image_pull(session, image)
        else:
            self.logger.info(
                "Not an environment or jupyter image, not notifying the orchest-api."
            )

    async def run(self):
        try:
            self.logger.info("Starting image puller.")
            # maxsize to avoid the queue being filled up with duplicate
            # work and reduce pressure on the orchest-api when not
            # needed.
            queue = asyncio.Queue(maxsize=self.threadiness)

            get_images_task = asyncio.create_task(self.get_active_images_to_pull(queue))
            pullers = [
                asyncio.create_task(self.pull_image(queue))
                for _ in range(self.threadiness)
            ]
            await asyncio.gather(*pullers, get_images_task)
        finally:
            await self.container_runtime.close()
