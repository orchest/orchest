from collections import namedtuple
import os

from docker.types import Mount


class DockerManager:
    """Manages containers on a local network.

    Attributes:
        client (docker.client.DockerClient)
        network (str): name of docker network to manage resources on.

    """
    def __init__(self, client, network='bridge'):
        self.client = client
        self.network = network


class JupyterDockerManager(DockerManager):
    """Manages all docker containers for Jupyter resources."""
    def _get_container_ip(self, container):
        """Get IP address of container.

        Args:
            container (docker.models.containers.Container)

        """
        # The containers have to be reloaded as otherwise cached "attrs"
        # is used, which might not be up-to-date.
        container.reload()
        return container.attrs['NetworkSettings']['Networks']['orchest']['IPAddress']

    def launch_pipeline(self, uuid, pipeline_dir):
        """Launches a configured Jupyter server and Jupyter EG.

        All containers are run in detached mode.

        Args:
            uuid (str): UUID of pipeline that is launched.
            pipeline_dir (str): path to pipeline files.

        """
        # TODO: Do we want a restart_policy when containers die
        #       "on_failure"?

        # TODO: the kernelspec should be put inside the image for the EG
        #       but for now this is fine as at allows easy development
        #       and addition of new kernels on the fly.
        abs_path = os.path.dirname(os.path.abspath(__file__))
        source_kernels = os.path.join(abs_path, '../../../../etc/kernels')
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

        pipeline_dir_target_path = "/notebooks"
        pipeline_dir_mount = Mount(
            target=pipeline_dir_target_path,
            source=pipeline_dir,
            type='bind'
        )

        # Run EG container, where EG_DOCKER_NETWORK ensures that kernels
        # started by the EG are on the same docker network as the EG.
        EG_container = self.client.containers.run(
                image='elyra/enterprise-gateway:dev',  # TODO: make not static.
                detach=True,
                mounts=[docker_sock_mount, kernelspec_mount],
                name=f'jupyter-EG-{uuid}',
                environment=[
                    f'EG_DOCKER_NETWORK={self.network}',
                    'EG_MIRROR_WORKING_DIRS=True'
                ],
                network=self.network
        )

        # Run Jupyter server container.
        server_container = self.client.containers.run(
                image='jupyter-server:latest',  # TODO: make not static. Some config.
                detach=True,
                mounts=[pipeline_dir_mount],
                name=f'jupyter-server-{uuid}',
                network=self.network
        )

        # Return IP addresses of the started containers.
        IP = namedtuple('IP', ['EG', 'server'])
        return IP(self._get_container_ip(EG_container), self._get_container_ip(server_container))

    def shutdown_pipeline(self, uuid):
        """Shuts down launched pipeline with given UUID.

        Stops and removes containers. Containers are removed such that
        the same container name can be used when the pipeline is
        relaunched.

        Args:
            uuid (str): pipeline uuid.

        Raises:
            ...

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

        return
