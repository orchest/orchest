from typing import List, Literal, Optional, Tuple

import docker

from app import utils
from app.config import DOCKER_NETWORK, ORCHEST_IMAGES, WRAP_LINES
from app.docker_wrapper import DockerWrapper


class OrchestResourceManager:
    orchest_images: List[str] = ORCHEST_IMAGES["all"]
    network: str = DOCKER_NETWORK

    def __init__(self):
        self.docker_client = DockerWrapper()

    def install_network(self) -> None:
        """Installs the Orchest Docker network."""
        # Don't install the network again if it is already installed
        # because that will create the another network with the same
        # name but with another ID. Thereby, breaking Orchest.
        try:
            is_installed = self.docker_client.is_network_installed(self.network)
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
                "Orchest sends anonymized telemetry to analytics.orchest.io."
                " To disable it, please refer to:",
                wrap=WRAP_LINES,
            )
            utils.echo(
                "\thttps://orchest.readthedocs.io/en/stable/user_guide/other.html#configuration"  # noqa: E501, W505
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
    ) -> Tuple[List[str], List[Optional[str]]]:
        """

        Args:
            state: The state of the container to be in in order for it
                to be returned.
        """
        return self.docker_client.get_containers(state=state, network=self.network)

    def get_env_build_imgs(self):
        return self.docker_client.list_image_ids(label="_orchest_project_uuid")

    def remove_env_build_imgs(self):
        env_build_imgs = self.get_env_build_imgs()
        self.docker_client.remove_images(env_build_imgs, force=True)

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
