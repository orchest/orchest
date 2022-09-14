import asyncio
import logging
from enum import Enum

import aiohttp
from container_runtime import ContainerRuntime


class Policy(Enum):
    IfNotPresent = "IfNotPresent"
    Always = "Always"


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

        # Container to make sure that images that are already being
        # pulled are not pulled concurrently again.
        self._curr_pulling_imgs = set()

    async def get_image_names(self, queue: asyncio.Queue):
        """Fetches the image names by calling following endpoints
        of the orchest-api.
            1. /ctl/orchest-images-to-pre-pull
            2. /environment-images/active
        Args:
            queue: The queue to put the image names to, the queue will
            be consumed by puller tasks.

        """

        async with aiohttp.ClientSession(trust_env=True) as session:
            while True:
                try:
                    endpoint = (
                        f"{self.orchest_api_host}/api/ctl/orchest-images-to-pre-pull"
                    )
                    async with session.get(endpoint) as response:
                        response_json = await response.json()
                        for image_name in response_json["pre_pull_images"]:
                            await queue.put(image_name)

                    endpoint = (
                        f"{self.orchest_api_host}/api/environment-images/active"
                        "?stored_in_registry=true"
                    )
                    async with session.get(endpoint) as response:
                        response_json = await response.json()
                        for image_name in response_json["active_environment_images"]:
                            await queue.put(image_name)

                    endpoint = (
                        f"{self.orchest_api_host}/api/ctl/active-custom-jupyter-images"
                        "?stored_in_registry=true"
                    )
                    async with session.get(endpoint) as response:
                        response_json = await response.json()
                        for image_name in response_json["active_custom_jupyter_images"]:
                            await queue.put(image_name)

                except Exception as ex:
                    self.logger.error(
                        f"Attempt to get image name from '{self.interval}' "
                        f"encountered exception. Exception was: {ex}."
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
            image_name = await queue.get()
            if self.policy == Policy.IfNotPresent:
                if (
                    image_name in self._curr_pulling_imgs
                    or await self.container_runtime.image_exists(image_name)
                ):
                    queue.task_done()
                    continue

            self.logger.info(
                f"Image '{image_name}' " "is not found - attempting pull..."
            )

            for retry in range(self.num_retries):
                try:
                    self.logger.info(f"Pulling image '{image_name}'...")
                    if await self.container_runtime.download_image(image_name):
                        break
                    self.logger.warning(f"Image '{image_name}' was not downloaded!")
                except Exception as ex:
                    self.logger.warning(
                        f"Attempt {retry} to pull image "
                        f"'{image_name}' failed with "
                        f"exception - retrying. Exception was: {ex}."
                    )
            queue.task_done()

    async def run(self):
        try:
            self.logger.info("Starting image puller.")
            queue = asyncio.Queue()

            get_images_task = asyncio.create_task(self.get_image_names(queue))
            pullers = [
                asyncio.create_task(self.pull_image(queue))
                for _ in range(self.threadiness)
            ]
            await asyncio.gather(*pullers, get_images_task)
        finally:
            await self.container_runtime.close()
