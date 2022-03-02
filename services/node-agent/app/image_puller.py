import time
import logging

from docker.client import DockerClient
from docker.errors import NotFound

from enum import Enum

class Policy(Enum):
    IfNotPresent = "IfNotPresent"
    Always = "Always"

class ImagePuller(object):
    def __init__(self, image_puller_interval,
                       image_puller_policy,
                       image_puller_retries,
                       image_puller_images,
                       image_puller_log_level):
        self.interval = image_puller_interval
        self.policy = image_puller_policy
        self.num_retries = image_puller_retries
        self.images = image_puller_images
        self.logger = logging.getLogger('image_puller')
        self.logger.setLevel(image_puller_log_level)

    def pull_image(self, image_name):
        """Pulls the image.

        If the policy is `IfNotPresent` the set of pulled image names is
        checked and, if present, the method returns.  Otherwise, the pull attempt is made
        and the set of pulled images is updated, when successful.
        """
        if self.policy == Policy.IfNotPresent:
            if self.image_exists(image_name):
                return
            self.logger.warning(f"Image '{image_name}' is not found - attempting pull...")

        self.logger.info(f"Pulling image '{image_name}'...")
        if not self.download_image(image_name):
            self.logger.warning(f"Image '{image_name}' was not downloaded!")

    def image_exists(self, image_name: str) -> bool:
        """Checks for the existence of the named image using the configured container runtime."""
        result = True
        t0 = time.time()
        try:
            DockerClient.from_env().images.get(image_name)
        except NotFound:
            result = False

        t1 = time.time()
        self.logger.debug(f"Checked existence of image '{image_name}' in {(t1 - t0):.3f} secs.  exists = {result}")
        return result

    def download_image(self, image_name: str) -> bool:
        """Downloads (pulls) the named image."""
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
                            self.logger.warning(f"Attempt {i} to pull image '{image_name}' encountered exception - retrying.  "
                                        f"Exception was: {ex}.")
                        else:
                            self.logger.error(f"Attempt {i} to pull image '{image_name}' failed with exception: {ex}")
