import asyncio
import logging
import time
from enum import Enum

from docker.client import DockerClient
from docker.errors import NotFound


class Policy(Enum):
    IfNotPresent = "IfNotPresent"
    Always = "Always"


class PullTaskMessage:
    def __init__(self, retry: int, image_name: str) -> None:
        self.retry = retry
        self.image_name = image_name


class ImagePuller(object):
    def __init__(
        self,
        image_puller_interval: int,
        image_puller_policy: Policy,
        image_puller_retries: int,
        image_puller_images: list,
        image_puller_log_level: str,
        image_puller_thrediness: int,
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
            image_puller_images (list): The list of images to be pulled,
                the image_names should include the tag and the
                repository
            image_puller_log_level (str): The log level of the component

        """

        self.interval = image_puller_interval
        self.policy = image_puller_policy
        self.num_retries = image_puller_retries
        self.images = image_puller_images
        self.thrediness = image_puller_thrediness
        self.logger = logging.getLogger("image_puller")
        self.logger.setLevel(image_puller_log_level)

    async def pull_image(self, queue: asyncio.Queue):
        """Pulls the image.

        If the policy is `IfNotPresent` the set of pulled image names
        is checked and, if present, the method returns. Otherwise, the
        pull attempt is made and the set of pulled images is updated,
        when successful.

        Args:
            queue: The queue to get the image name from.

        """

        pull_task = await queue.get()

        if self.policy == Policy.IfNotPresent:
            if self.image_exists(pull_task.image_name):
                self.logger.info(
                    f"Image '{pull_task.image_name}' is not found - attempting pull..."
                )

        try:
            self.logger.info(f"Pulling image '{pull_task.image_name}'...")
            if not self.download_image(pull_task.image_name):
                self.logger.warning(
                    f"Image '{pull_task.image_name}' was not downloaded!"
                )
        except Exception as ex:
            if pull_task.retry < self.num_retries:
                self.logger.warning(
                    f"Attempt {pull_task.retry} to pull image "
                    f"'{pull_task.image_name}' failed with "
                    f"exception - retrying. Exception was: {ex}."
                )
                # re-queue the pull task to be processed again
                await queue.put(
                    PullTaskMessage(pull_task.retry + 1, pull_task.image_name)
                )

            else:
                self.logger.error(
                    f"Attempt {pull_task.retry} to pull image: "
                    f"'{pull_task.image_name}' failed with "
                    f"exception: {ex}"
                )

        queue.task_done()

    def image_exists(self, image_name: str) -> bool:
        """Checks for the existence of the named image using
        the configured container runtime.

        Args:
            image_name: The name of the image to be checked.

        Returns:
            True if exist locally, False otherwise.

        """
        result = True
        t0 = time.time()
        try:
            DockerClient.from_env().images.get(image_name)
        except NotFound:
            result = False

        t1 = time.time()
        self.logger.debug(
            f"Checked existence of image '{image_name} '"
            f"in {(t1 - t0):.3f} secs.  exists = {result}"
        )
        return result

    def download_image(self, image_name: str) -> bool:
        """Downloads (pulls) the named image.

        Args:
            image_name: The name of the image for downloading.

        Returns:
            True if download was successful, False otherwise.

        """
        result = True
        t0 = time.time()
        try:
            DockerClient.from_env().images.pull(image_name)
        except NotFound:
            result = False
        t1 = time.time()
        if result is True:
            self.logger.info(f"Pulled image '{image_name}' in {(t1 - t0):.3f} secs.")
        return result

    async def run(self):

        self.logger.info("Starting image puller.")

        queue = asyncio.Queue()
        for _ in range(self.thrediness):
            asyncio.create_task(self.pull_image(queue))

        while True:

            for image_name in self.images:
                # Create a pull task, with image_name which will
                # be consumed by image puller tasks.
                queue.put_nowait(PullTaskMessage(1, image_name))

            await queue.join()
            await asyncio.sleep(self.interval)
