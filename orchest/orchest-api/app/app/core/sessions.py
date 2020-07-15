from abc import abstractmethod
from contextlib import contextmanager
import logging
import sys
import time
from typing import Dict, NamedTuple, Optional
import os

from docker.types import Mount
import requests


logging.basicConfig(stream=sys.stdout, level=logging.INFO)


@contextmanager
def launch_session(docker_client, pipeline_uuid, pipeline_dir, interactive=False):
    """Launch session for a particular pipeline.

    Args:
        docker_client (docker.client.DockerClient): docker client to
            manage Docker resources.
        pipeline_uuid: UUID of pipeline that the session is started for.
        pipeline_dir: Path to the `pipeline_dir`, which has to be
            mounted into the containers so that the user can interact
            with the files.
        interactive: If True then launch :class:`InteractiveSession`, if
            False then launch :class:`NonInteractiveSession`.

    """
    session = InteractiveSession if interactive else NonInteractiveSession

    session = session(docker_client, network='orchest')
    session.launch(pipeline_uuid, pipeline_dir)
    try:
        yield session
    finally:
        session.shutdown()


class IP(NamedTuple):
    jupyter_EG: str
    jupyter_server: str


# TODO: possibly make contextlib session.
class Session:
    """Manages resources for a session.

    A session is ...

    Manages Docker containers.

    Attributes:
        client (docker.client.DockerClient): docker client to manage
            Docker resources.
        network: name of docker network to manage resources on.
    """
    _resources: Optional[list] = None

    def __init__(self, client, network: Optional[str] = None):
        self.client = client
        self.network = network

        self._containers = {}

    @classmethod
    def from_container_IDs(cls, client, container_IDs, network=None):
        """

        If `network` is ``None``, then the network is infered based on
        the network of the first respectively given container.
        """
        session = cls(client)
        for resource, ID in container_IDs.items():
            container = session.client.containers.get(ID)

            if network is None:
                network, _ = container.attrs['NetworkSettings']['Networks'].popitem()

            session._containers[resource] = container

        session.network = network

        return session

    @property
    def containers(self) -> dict:
        if not self._containers:
            # TODO: filter and get the containers for this session.
            #       Maybe make use of some session-uuid.
            pass

        return self._containers

    def get_container_IDs(self) -> Dict[str, str]:
        """Gets container IDs of running resources of this Session.

        Returns:
            Mapping from resource (name) to container ID.

        """
        # The API can use this to get the IDs to then later give them
        # back so that it can use the IDs to do the shutdown.
        res = {}
        for name, container in self.containers.items():
            res[name] = container.id

        return res

    def launch(self, uuid: str, pipeline_dir: str) -> None:
        """Launches a configured Jupyter server and Jupyter EG.

        All containers are run in detached mode.

        Args:
            uuid: UUID of pipeline that is launched.
            pipeline_dir: path to pipeline files.
        """
        # TODO: make convert this "pipeline" uuid into a "session" uuid.
        container_specs = _get_container_specs(uuid, pipeline_dir, self.network)
        for resource in self._resources:
            container = self.client.containers.run(**container_specs[resource])
            self._containers[resource] = container

        return

    @abstractmethod
    def shutdown(self) -> None:
        """Shuts down launched pipeline with given UUID.

        Stops and removes containers. Containers are removed such that
        the same container name can be used when the pipeline is
        relaunched.

        Returns:
            None. If no error is raised, then it means the pipeline was
            shut down successfully.
        """
        for resource, container in self.containers.items():
            # TODO: this depends on whether or not auto_remove is
            #       enabled in the container specs.
            container.stop()
            container.remove()

        return


class InteractiveSession(Session):
    """Manages resources for an interactive session."""

    _resources = [
        'memory-server',
        'jupyter-EG',
        'jupyter-server',
    ]

    def __init__(self, client, network):
        super().__init__(client, network)

        self._jupyter_server_info = None

    @property
    def jupyter_server_info(self):
        # TODO: maybe error if launch was not called yet
        if self._jupyter_server_info is None:
            pass

        return self._jupyter_server_info

    def _get_container_IP(self, container) -> str:
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

    # TODO: rename to `get_resources_IP` ?
    def get_containers_IP(self) -> IP:
        """Launches a configured Jupyter server and Jupyter EG.

        Returns:
            A namedtuple of the IPs of the jupyter-EG container
            and jupyter-server container respectively.
        """
        # TODO: Do we want a restart_policy when containers die
        #       "on_failure"?
        if not self.containers:
            # TODO: maybe raise error that no resources were found, try
            #       launching the session first.
            return

        return IP(self._get_container_IP(self.containers['jupyter-EG']),
                  self._get_container_IP(self.containers['jupyter-server']))

    def launch(self, uuid: str, pipeline_dir: str) -> None:
        super().launch(uuid, pipeline_dir)

        # TODO: This session should manage additionally that the jupyter
        #       notebook server is started through the little flask API
        #       that is running inside the container.

        IP = self.get_containers_IP()
        # The launched jupyter-server container is only running the API
        # and waits for instructions before the Jupyter server is
        # started. Tries to start the Jupyter server, by waiting for the
        # API to be running after container launch.
        logging.info('Starting Jupyter Server on %s with Enterprise '
                     'Gateway on %s' % (IP.jupyter_server, IP.jupyter_EG))
        payload = {
            'gateway-url': f'http://{IP.jupyter_EG}:8888',
            'NotebookApp.base_url': f'/jupyter_{IP.jupyter_server.replace(".", "_")}/'
        }
        for i in range(10):
            try:
                # Starts the Jupyter server and connects it to the given
                # Enterprise Gateway.
                r = requests.post(
                    f'http://{IP.jupyter_server}:80/api/servers/',
                    json=payload
                )
            except requests.ConnectionError:
                # TODO: there is probably a robuster way than a sleep.
                #       Does the EG url have to given at startup? Because
                #       else we don't need a time-out and simply give it
                #       later.
                time.sleep(0.5)
            else:
                break

        self._jupyter_server_info = r.json()
        return

    def shutdown(self) -> None:
        # TODO: make sure a graceful shutdown is instantiated via a
        #       DELETE request to the flask API inside the jupyter-server
        IP = self.get_containers_IP()
        requests.delete(f'http://{IP.jupyter_server}:80/api/servers/')

        return super().shutdown()

    def restart_resource(self, resource_name='memory-server'):
        # TODO: make sure the InteractiveSession db.Model had an updated
        #       docker ID if it changes on restart.
        # TODO: should be possible to clear the memory store. So either
        #       clear or reboot it.
        container = self.containers[resource_name]

        # TODO: make sure the .sock still gets cleaned and a new one is
        #       created. In other words, make sure cleanup code is still
        #       called.
        # NOTE: Docker ID does not change when restarting the container.
        container.restart(timeout=5)  # timeout in sec before killing


class NonInteractiveSession(Session):
    """Manages resources for a non-interactive session."""

    _resources = [
        'memory-server',
    ]

    def __init__(self, client, network):
        super().__init__(client, network)


def _get_mounts(pipeline_dir):
    mounts = {}

    # TODO: the kernelspec should be put inside the image for the EG
    #       but for now this is fine as at allows easy development
    #       and addition of new kernels on the fly.
    source_kernels = os.path.join(pipeline_dir, '.kernels')
    mounts['kernelspec'] = Mount(
        target='/usr/local/share/jupyter/kernels',
        source=source_kernels,
        type='bind'
    )

    # By mounting the docker sock it becomes possible for containers
    # to be spawned from inside another container.
    mounts['docker_sock'] = Mount(
        target='/var/run/docker.sock',
        source='/var/run/docker.sock',
        type='bind'
    )

    pipeline_dir_target_path = '/notebooks'
    mounts['pipeline_dir'] = Mount(
        target=pipeline_dir_target_path,
        source=pipeline_dir,
        type='bind'
    )

    # TODO: For now the memory-server will be booted when jupyter
    #       is started. This will change in the near future.
    mounts['memory_server_sock'] = Mount(
        target='/tmp',
        source=pipeline_dir,
        type='bind'
    )

    return mounts


def _get_container_specs(uuid, pipeline_dir, network):
    # TODO: possibly add ``auto_remove=True`` to the specs.
    container_specs = {}
    mounts = _get_mounts(pipeline_dir)

    container_specs['memory-server'] = {
        'image': 'orchestsoftware/memory-server:latest',
        'detach': True,
        'mounts': [
            mounts['pipeline_dir'],
            mounts['memory_server_sock'],
        ],
        'name': 'memory-server',
        'network': network,
        'shm_size': int(1.2e9),  # need to overalocate to get 1G
    }

    # Run EG container, where EG_DOCKER_NETWORK ensures that kernels
    # started by the EG are on the same docker network as the EG.
    container_specs['jupyter-EG'] = {
        'image': 'elyra/enterprise-gateway:2.1.1',  # TODO: make not static.
        'detach': True,
        'mounts': [
            mounts['docker_sock'],
            mounts['kernelspec'],
        ],
        'name': f'jupyter-EG-{uuid}',
        'environment': [
            f'EG_DOCKER_NETWORK={network}',
            'EG_MIRROR_WORKING_DIRS=True',
            'EG_LIST_KERNELS=True',
            ('EG_KERNEL_WHITELIST=['
                '"orchestsoftware-scipy-notebook-augmented_docker_python",'
                '"orchestsoftware-r-notebook-augmented_docker_ir"'
            ']'),
            'EG_UNAUTHORIZED_USERS=["dummy"]',
            'EG_UID_BLACKLIST=["-1"]',
            'EG_ALLOW_ORIGIN=*',
        ],
        'user': 'root',
        'network': network,
    }

    # Run Jupyter server container.
    container_specs['jupyter-server'] = {
        'image': 'orchestsoftware/jupyter-server:latest',  # TODO: make not static.
        'detach': True,
        'mounts': [
            mounts['pipeline_dir']
        ],
        'name': f'jupyter-server-{uuid}',
        'network': network,
        'environment': [
            'KERNEL_UID=0'
        ],
    }

    return container_specs
