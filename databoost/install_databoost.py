"""Installation script for databoost.

Sets up the following
* Docker
* ...

"""
import docker
from docker.client import DockerClient


# TODO: Create some settings file somewhere, including:
#       * port specification: what ports for Jupyter
#       * image names in ENV variables


# ---------------
# -- Docker
# ---------------
docker_client = DockerClient.from_env()

# Pull all images needed for databoost.
# docker_client.images.pull('image-name')

# Create Docker network named "databoost" with a custom subnet such that
# containers can be spawned at custom static IP addresses.
ipam_pool = docker.types.IPAMPool(subnet='172.31.0.0/16')
ipam_config = docker.types.IPAMConfig(pool_configs=[ipam_pool])
docker_client.networks.create(
    "databoost",
    driver="bridge",
    ipam=ipam_config
)
