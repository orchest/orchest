from abc import abstractmethod
from contextlib import contextmanager
import logging
import sys
import time
from typing import Dict, NamedTuple, Optional, Union
from uuid import uuid4
import os

from docker.types import Mount
import requests

from _orchest.internals import config as _config


# TODO: logging should probably be done toplevel instead of here.
logging.basicConfig(stream=sys.stdout, level=logging.INFO)


class IP(NamedTuple):
    jupyter_EG: str
    jupyter_server: str


# TODO: possibly make contextlib session by implementing __enter__ and
#       __exit__
class Session:
    """Manages resources for a session.

    A session is used to launch and shutdown particular resources.
    For example during an interactive session the Jupyter environment is
    booted together with a memory-server. The session directly manages
    the lifecycle of these resources.

    In essence simply manages Docker containers.

    Attributes:
        client (docker.client.DockerClient): Docker client to manage
            Docker resources.
        network: Name of docker network to manage resources on.

    """
    _resources: Optional[list] = None

    def __init__(self, client, network: Optional[str] = None):
        self.client = client
        self.network = network

        self._containers = {}

    @classmethod
    def from_container_IDs(cls,
                           client,
                           container_IDs: Dict[str, str],
                           network: Optional[str] = None) -> 'Session':
        """Constructs a session object from container IDs.

        If `network` is ``None``, then the network is infered based on
        the network of the first respectively given container.

        Args:
            client (docker.client.DockerClient): Docker client to manage
                Docker resources.
            network: Name of docker network to manage resources on.

        Returns:
            Instantiated Session object.

        """
        session = cls(client)
        for resource, ID in container_IDs.items():
            container = session.client.containers.get(ID)

            # Infer the network by taking a random network from its
            # settings. Often it contains only one network, thus popping
            # a random network simply returns the only network.
            if network is None:
                network, _ = container.attrs['NetworkSettings']['Networks'].popitem()

            session._containers[resource] = container

        session.network = network

        return session

    @property
    def containers(self) -> Dict[str, 'docker.models.containers.Container']:
        """Returns the running containers for the current session.

        Containers are identified by a short version of their name. The
        names are equal to the specifics class ``_resources`` attribute.

        """
        if not self._containers:
            # TODO: filter and get the containers for this session.
            #       Maybe make use of some session-uuid.
            pass

        return self._containers

    # TODO: possible make into property "ids"
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
        """Launches pre-configured resources.

        All containers are run in detached mode.

        Args:
            uuid: UUID to identify the session with. It is passed to the
                :meth:`_get_container_specs` method. Meaning `uuid` is
                recommended to be either a pipeline UUID (for
                interactive sessions) or pipeline run UUID (for non-
                interactive sessions).
            pipeline_dir: Path to pipeline directory.

        """
        # TODO: make convert this "pipeline" uuid into a "session" uuid.
        container_specs = _get_container_specs(uuid, pipeline_dir, self.network)
        for resource in self._resources:
            container = self.client.containers.run(**container_specs[resource])
            self._containers[resource] = container

        return

    @abstractmethod
    def shutdown(self) -> None:
        """Shuts down session.

        Stops and removes containers. Containers are removed so that the
        same container name can be used when the pipeline is relaunched.

        Returns:
            None if no error is raised meaning the pipeline shutdown was
            successful.

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

    def __init__(self, client, network=None):
        super().__init__(client, network)

        self._notebook_server_info = None

    @property
    def notebook_server_info(self):
        """Contains the information to connect to the notebook server."""
        # TODO: maybe error if launch was not called yet
        if self._notebook_server_info is None:
            pass

        return self._notebook_server_info

    def _get_container_IP(self, container) -> str:
        """Get IP address of container.

        Args:
            container (docker.models.containers.Container): container of
                which to get the IP address.

        Returns:
            The IP address of the container inside the network.

        """
        # The containers have to be reloaded as otherwise cached "attrs"
        # is used, which might not be up-to-date.
        container.reload()
        return container.attrs['NetworkSettings']['Networks'][self.network]['IPAddress']

    # TODO: rename to `get_resources_IP` ?
    # TODO: make into property? `.ips` Same goes for `get_container_IDs`
    def get_containers_IP(self) -> IP:
        """Gets the IP addresses of the jupyter server and EG.

        Returns:
            A namedtuple of the IPs of the `jupyter-EG` container and
            `jupyter-server` container respectively.

        """
        # TODO: Do we want a restart_policy when containers die
        #       "on_failure"?
        if not self.containers:
            # TODO: maybe raise error that no resources were found, try
            #       launching the session first.
            return

        return IP(self._get_container_IP(self.containers['jupyter-EG']),
                  self._get_container_IP(self.containers['jupyter-server']))

    def launch(self, pipeline_uuid: str, pipeline_dir: str) -> None:
        """Launches the interactive session.

        Additionally connects the launched `jupyter-server` with the
        `jupyter-enterprise-gateway` (shot `jupyter-EG`).

        Args:
            See `Args` section in parent class :class:`Session`.

        """
        super().launch(pipeline_uuid, pipeline_dir)

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

        self._notebook_server_info = r.json()
        return

    def shutdown(self) -> None:
        """Shuts down the launch.

        Additionally issues a DELETE request to the `jupyter-server` to
        have it shut down gracefully. Meaning that all its running
        kernels are shut down as well.

        """
        # NOTE: this request will block the API. However, this is
        # desired as the front-end would otherwise need to poll whether
        # the Jupyter launch has been shut down (to be able to show its
        # status in the UI).
        # Uses the API inside the container that is also running the
        # Jupyter server to shut the server down and clean all running
        # kernels that are associated with the server.
        # The request is blocking and returns after all kernels and
        # server have been shut down.
        # TODO: make sure a graceful shutdown is instantiated via a
        #       DELETE request to the flask API inside the jupyter-server
        IP = self.get_containers_IP()
        requests.delete(f'http://{IP.jupyter_server}:80/api/servers/')

        return super().shutdown()

    def restart_resource(self, resource_name='memory-server'):
        """Restarts a resource by name.

        Especially for the `memory-server` this comes in handy. Because
        the user should be able to clear the server. Which internally we
        do by restarting it, since clearing would also lose all state.
        Note that restarting the `memory-server` resets its eviction
        state, which is exactly what we want.

        """
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

    def __init__(self, client, network=None):
        super().__init__(client, network)

        self._session_uuid = str(uuid4())

    def launch(self, uuid: Optional[str], pipeline_dir: str) -> None:
        """

        Since multiple memory-servers are started for the same pipeline,
        since their can be multiple pipeline runs, every pipeline run
        and therefore session needs to have a unique docker container
        name for its memory-server.

        For experiments a good option for the `uuid` would be the
        pipeline run UUID. If none is given

        Args:
            uuid: Some UUID. If ``None`` then a randomly generated UUID
                is used.

        """
        if uuid is None:
            uuid = self._session_uuid

        return super().launch(uuid, pipeline_dir)


@contextmanager
def launch_session(
    docker_client,
    pipeline_uuid: str,
    pipeline_dir: str,
    interactive: bool = False
) -> Union[InteractiveSession, NonInteractiveSession]:
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

    Yields:
        A Session object that has already launched its resources.

    """
    session = InteractiveSession if interactive else NonInteractiveSession

    session = session(docker_client, network='orchest')
    session.launch(pipeline_uuid, pipeline_dir)
    try:
        yield session
    finally:
        session.shutdown()


def _get_mounts(pipeline_dir: str) -> Dict[str, Mount]:
    """Constructs the mounts for all resources.

    Resources refer to the union of all possible resources over all
    types of session objects.

    Args:
        pipeline_dir: Pipeline directory w.r.t. the host. Needed to
            construct the mounts.

    Returns:
        Mapping from mount name to actual ``docker.types.Mount`` object.
        The return dict looks as follows:
            mounts = {
                'kernelspec': Mount,
                'docker_sock': Mount,
                'pipeline_dir': Mount,
            }

    """
    mounts = {}

    # TODO: the kernelspec should be put inside the image for the EG
    #       but for now this is fine as at allows easy development
    #       and addition of new kernels on the fly.
    source_kernelspecs = os.path.join(pipeline_dir, _config.KERNELSPECS_PATH)
    mounts['kernelspec'] = Mount(
        target='/usr/local/share/jupyter/kernels',
        source=source_kernelspecs,
        type='bind'
    )

    # By mounting the docker sock it becomes possible for containers
    # to be spawned from inside another container.
    mounts['docker_sock'] = Mount(
        target='/var/run/docker.sock',
        source='/var/run/docker.sock',
        type='bind'
    )

    pipeline_dir_target_path = _config.PIPELINE_DIR
    mounts['pipeline_dir'] = Mount(
        target=pipeline_dir_target_path,
        source=pipeline_dir,
        type='bind'
    )

    # The `memory-server` creates the `plasma.sock` file at
    # `STORE_SOCKET_NAME` from its configuration file, which is
    # currently ``/tmp/plasma.sock``. Thus to get the socket in the
    # pipeline directory we need to mount the ``/tmp`` directory.
    source_memory_server_sock = os.path.join(pipeline_dir, _config.SOCK_PATH)
    mounts['memory_server_sock'] = Mount(
        target=_config.MEMORY_SERVER_SOCK_PATH,
        source=source_memory_server_sock,
        type='bind'
    )

    return mounts


def _get_container_specs(uuid: str, pipeline_dir: str, network: str) -> Dict[str, dict]:
    """Constructs the container specifications for all resources.

    These specifications can be unpacked into the
    ``docker.client.DockerClient.containers.run`` method.

    Args:
        uuid: Some UUID to identify the session with. For interactive
            runs using the pipeline UUID is recommended, for non-
            interactive runs we recommend using the pipeline run UUID.
        pipeline_dir: Pipeline directory w.r.t. the host. Needed to
            construct the mounts.
        network: Docker network. This is put directly into the specs, so
            that the containers are started on the specified network.

    Returns:
        Mapping from container name to container specification for the
        run method. The return dict looks as follows:
            mounts = {
                'memory-server': spec dict,
                'jupyter-EG': spec dict,
                'jupyter-server': spec dict,
            }

    """
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
        # TODO: name not unique... and uuid cannot be used.
        'name': f'memory-server-{uuid}',
        'network': network,
        'shm_size': int(1.2e9),  # need to overalocate to get 1G
    }

    # Run EG container, where EG_DOCKER_NETWORK ensures that kernels
    # started by the EG are on the same docker network as the EG.
    container_specs['jupyter-EG'] = {
        'image': 'elyra/enterprise-gateway:2.2.0rc2',  # TODO: make not static.
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
                '"orchestsoftware-custom-base-kernel-py_docker_python",'
                '"orchestsoftware-custom-base-kernel-r_docker_ir"'
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
