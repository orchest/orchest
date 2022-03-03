import logging
import time
from enum import Enum

from docker.client import DockerClient
from docker.errors import NotFound


class Policy(Enum):
    IfNotPresent = "IfNotPresent"
    Always = "Always"


class ImagePuller(object):
    def __init__(
        self,
        image_puller_interval: int,
        image_puller_policy: Policy,
        image_puller_retries: int,
        image_puller_images: list,
        image_puller_log_level: str,
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
        self.logger = logging.getLogger("image_puller")
        self.logger.setLevel(image_puller_log_level)

    def pull_image(self, image_name: str):
        """Pulls the image.

        If the policy is `IfNotPresent` the set of pulled image names
        is checked and, if present, the method returns. Otherwise, the
        pull attempt is made and the set of pulled images is updated,
        when successful.

        Args:
            image_name: The name of the image to be pulled.

        """
        if self.policy == Policy.IfNotPresent:
            if self.image_exists(image_name):
                return
            self.logger.info(f"Image '{image_name}' is not found - attempting pull...")

        self.logger.info(f"Pulling image '{image_name}'...")
        if not self.download_image(image_name):
            self.logger.warning(f"Image '{image_name}' was not downloaded!")

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

        while True:
            for image_name in self.images:
                i = 0
                while i < self.num_retries:
                    try:
                        self.pull_image(image_name)
                        break
                    except Exception as ex:
                        i += 1
                        if i < self.num_retries:
                            self.logger.warning(
                                f"Attempt {i} to pull image '{image_name}'"
                                "encountered exception - retrying. "
                                f"Exception was: {ex}."
                            )
                        else:
                            self.logger.error(
                                f"Attempt {i} to pull image '{image_name}' "
                                f"failed with exception: {ex}"
                            )
