import os
from typing import NamedTuple
import time
from docker.types import Mount
import subprocess

class IP(NamedTuple):
    EG: str
    server: str


class DockerManager:
    """Manages containers on a local network.

    Attributes:
        client (docker.client.DockerClient): docker client to manage
            Docker recourses.
        network: name of docker network to manage resources on.
    """
    def __init__(self, client, network: str = 'bridge'):
        self.client = client
        self.network = network


class JupyterDockerManager(DockerManager):
    """Manages all docker containers for Jupyter resources."""
    def _get_container_ip(self, container) -> str:
        """Get IP address of container.

        Args:
            container (docker.models.containers.Container): container of
                which to get the IP address.

        Returns:
            The IPAdress of the container inside the network.
        """
        # The containers have to be reloaded as otherwise cached "attrs"
        # is used, which might not be up-to-date.
        container.reload()
        return container.attrs['NetworkSettings']['Networks'][self.network]['IPAddress']

    def launch_pipeline(self, uuid: str, pipeline_dir: str) -> IP:
        """Launches a configured Jupyter server and Jupyter EG.

        All containers are run in detached mode.

        Args:
            uuid: UUID of pipeline that is launched.
            pipeline_dir: path to pipeline files.

        Returns:
            A namedtuple of the IPs of the enterprise-gateway container
            and jupyter-server container respectively.
        """
        # TODO: Do we want a restart_policy when containers die
        #       "on_failure"?

        # TODO: the kernelspec should be put inside the image for the EG
        #       but for now this is fine as at allows easy development
        #       and addition of new kernels on the fly.
        source_kernels = os.path.join(pipeline_dir, '.kernels')
        kernelspec_mount = Mount(
                target='/usr/local/share/jupyter/kernels',
                source=source_kernels,
                type='bind'
        )

        # By mounting the docker sock it becomes possible for containers
        # to be spawned from inside another container.
        docker_sock_mount = Mount(
                target='/var/run/docker.sock',
                source='/var/run/docker.sock',
                type='bind'
        )

        pipeline_dir_target_path = '/notebooks'
        pipeline_dir_mount = Mount(
            target=pipeline_dir_target_path,
            source=pipeline_dir,
            type='bind'
        )

        # TODO: For now the memory-server will be booted when jupyter
        #       is started. This will change in the near future.
        store_dir_mount = Mount(
            target='/tmp',
            source=pipeline_dir,
            type='bind'
        )
        memory_server_container = self.client.containers.run(
            image='orchestsoftware/memory-server:latest',
            detach=True,
            mounts=[pipeline_dir_mount, store_dir_mount],
            name='memory-server',
            network=self.network,
            shm_size=int(1.2e9)  # need to overalocate to get 1G
        )

        # Run EG container, where EG_DOCKER_NETWORK ensures that kernels
        # started by the EG are on the same docker network as the EG.
        EG_container = self.client.containers.run(
                image='elyra/enterprise-gateway:2.1.1',  # TODO: make not static.
                detach=True,
                mounts=[docker_sock_mount, kernelspec_mount],
                name=f'jupyter-EG-{uuid}',
                environment=[
                    f'EG_DOCKER_NETWORK={self.network}',
                    'EG_MIRROR_WORKING_DIRS=True',
                    'EG_LIST_KERNELS=True',
                    ('EG_KERNEL_WHITELIST=["orchestsoftware-scipy-notebook-augmented_docker_python","orchestsoftware-r-notebook-augmented_docker_ir"]'),
                    "EG_UNAUTHORIZED_USERS=['dummy']",
                    "EG_UID_BLACKLIST=['-1']",
                    "EG_ALLOW_ORIGIN=*"
                ],
                user='root',
                network=self.network
        )

        # Run Jupyter server container.
        server_container = self.client.containers.run(
                image='orchestsoftware/jupyter-server:latest',  # TODO: make not static.
                detach=True,
                mounts=[pipeline_dir_mount],
                name=f'jupyter-server-{uuid}',
                network=self.network,
                environment=[
                    'KERNEL_UID=0'
                ]
        )

        # Return IP addresses of the started containers.
        return IP(self._get_container_ip(EG_container),
                  self._get_container_ip(server_container))

    def shutdown_pipeline(self, uuid: str) -> None:
        """Shuts down launched pipeline with given UUID.

        Stops and removes containers. Containers are removed such that
        the same container name can be used when the pipeline is
        relaunched.

        Args:
            uuid: pipeline uuid.

        Raises:
            TODO

        Returns:
            None. If no error is raised, then it means the pipeline was
            shut down successfully.
        """
        pattern = f'jupyter-(EG|server)-{uuid}'

        # TODO: error handling when stopping did not succeed.
        # TODO: error when given pipeline is not running.
        # TODO: Not removing containers, but restarting them?
        for container in self.client.containers.list(filters={'name': pattern}):
            container.stop()
            container.remove()

        # TODO: Will be managed some place else in the near future.
        for container in self.client.containers.list(filters={'name': 'memory-server'}):
            container.stop()
            container.remove()

        return
