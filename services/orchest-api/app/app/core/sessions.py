from abc import abstractmethod
from contextlib import contextmanager
from typing import Dict, NamedTuple, Optional, Union
from uuid import uuid4
import logging
import os
import sys
import time
from docker.errors import APIError, NotFound, ContainerError

from docker.types import Mount
import requests

from app import utils
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
    def from_container_IDs(
        cls,
        client,
        container_IDs: Dict[str, str],
        network: Optional[str] = None,
        notebook_server_info: Dict[str, str] = None,
    ) -> "Session":
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

        session._notebook_server_info = notebook_server_info

        for resource, ID in container_IDs.items():
            container = session.client.containers.get(ID)

            # Infer the network by taking a random network from its
            # settings. Often it contains only one network, thus popping
            # a random network simply returns the only network.
            if network is None:
                network, _ = container.attrs["NetworkSettings"]["Networks"].popitem()

            session._containers[resource] = container

        session.network = network

        return session

    @property
    def containers(self) -> Dict[str, "docker.models.containers.Container"]:
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

    def launch(
        self,
        uuid: str,
        project_uuid: str,
        pipeline_path: str,
        project_dir: str,
        data_passing_memory_size: int,
        host_userdir: Optional[str] = None,
    ) -> None:
        """Launches pre-configured resources.

        All containers are run in detached mode.

        Args:
            uuid: UUID to identify the session with. It is passed to the
                :meth:`_get_container_specs` method. Meaning `uuid` is
                recommended to be either a pipeline UUID (for
                interactive sessions) or pipeline run UUID (for non-
                interactive sessions).
            pipeline_path: Path to pipeline file (relative to project_dir).
            project_dir: Path to project directory.
            host_userdir: Path to the userdir on the host
            data_passing_memory_size: Size for the "memory-server".

        """
        # TODO: make convert this "pipeline" uuid into a "session" uuid.
        container_specs = _get_container_specs(
            uuid,
            project_uuid,
            pipeline_path,
            project_dir,
            host_userdir,
            self.network,
            data_passing_memory_size,
        )
        for resource in self._resources:
            container = self.client.containers.run(**container_specs[resource])
            self._containers[resource] = container

        return

    @abstractmethod
    def shutdown(self) -> None:
        """Shuts down session.

        Stops and removes containers. Containers are removed so that the
        same container name can be used when the pipeline is relaunched.
        Temporary volumes related to the session are removed.

        Returns:
            None if no error is raised meaning the pipeline shutdown was
            successful.

        """

        session_identity_uuid = None
        project_uuid = None

        for resource, container in self.containers.items():
            # TODO: this depends on whether or not auto_remove is
            #       enabled in the container specs.

            # we are relying on the fact
            # that the session_identity_uuid and project_uuid are consistent among
            # these containers, i.e. there is 1 of each
            if session_identity_uuid is not None:
                session_identity_uuid = container.labels.get("session_identity_uuid")
            if project_uuid is not None:
                project_uuid = container.labels.get("project_uuid")

            # catch to take care of the race condition where a session
            # is already shutting down on its own but a shutdown
            # command is issued by a project/pipeline/exp deletion
            # at the same time
            try:
                container.stop()
                container.remove()
            except (requests.exceptions.HTTPError, NotFound, APIError, ContainerError):
                pass

        # the reasons such removal needs to be done in sessions.py
        # instead of pipelines.py are: 1) in an experiment run, the
        # memory server is the last container that is removed, that
        # happens when the session is shutting down, before that happens
        # the TMP volume(s) cannot be removed 2) this way we also
        # cleanup the volumes of an interactive session when the session
        # shuts down
        if session_identity_uuid and project_uuid:
            volume = self.client.volumes.get(
                _config.TEMP_VOLUME_NAME.format(
                    uuid=session_identity_uuid, project_uuid=project_uuid
                )
            )
            # catch to take care of the race condition where a session
            # is already shutting down on its own but a shutdown
            # command is issued by a project/pipeline/exp deletion
            # at the same time
            try:
                volume.remove()
            except (requests.exceptions.HTTPError, NotFound, APIError):
                pass

        return


class InteractiveSession(Session):
    """Manages resources for an interactive session."""

    _resources = [
        "memory-server",
        "jupyter-EG",
        "jupyter-server",
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
        return container.attrs["NetworkSettings"]["Networks"][self.network]["IPAddress"]

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

        return IP(
            self._get_container_IP(self.containers["jupyter-EG"]),
            self._get_container_IP(self.containers["jupyter-server"]),
        )

    def launch(
        self,
        pipeline_uuid: str,
        project_uuid: str,
        pipeline_path: str,
        project_dir: str,
        data_passing_memory_size: int,
        host_userdir: str,
    ) -> None:
        """Launches the interactive session.

        Additionally connects the launched `jupyter-server` with the
        `jupyter-enterprise-gateway` (shot `jupyter-EG`).

        Args:
            See `Args` section in parent class :class:`Session`.

        """
        super().launch(
            pipeline_uuid,
            project_uuid,
            pipeline_path,
            project_dir,
            data_passing_memory_size,
            host_userdir,
        )

        IP = self.get_containers_IP()

        logging.info(
            "Starting Jupyter Server on %s with Enterprise "
            "Gateway on %s" % (IP.jupyter_server, IP.jupyter_EG)
        )

        self._notebook_server_info = {
            "port": 8888,
            "base_url": "/"
            + _config.JUPYTER_SERVER_NAME.format(
                project_uuid=project_uuid[: _config.TRUNCATED_UUID_LENGTH],
                pipeline_uuid=pipeline_uuid[: _config.TRUNCATED_UUID_LENGTH],
            ),
        }

        # Poll jupyter_server until available
        url = f"http://{IP.jupyter_server}{self._notebook_server_info['base_url']}/api"
        for _ in range(10):
            try:
                requests.get(url)
            except requests.ConnectionError:
                time.sleep(0.5)
            else:
                break

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
        # The request is blocking and returns after all kernels and
        # server have been shut down.
        IP = self.get_containers_IP()

        utils.shutdown_jupyter_server(
            f"http://{IP.jupyter_server}:8888{self._notebook_server_info['base_url']}/"
        )

        return super().shutdown()

    def restart_resource(self, resource_name="memory-server"):
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
        "memory-server",
    ]

    def __init__(self, client, network=None):
        super().__init__(client, network)

        self._session_uuid = str(uuid4())

    def launch(
        self,
        uuid: Optional[str],
        project_uuid: str,
        pipeline_path: str,
        project_dir: str,
        data_passing_memory_size: int,
    ) -> None:
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
            pipeline_path: Path to the pipeline file relative to the `project_dir`.
            project_dir: Path to the project directory on the host.

        """
        if uuid is None:
            uuid = self._session_uuid

        return super().launch(
            uuid, project_uuid, pipeline_path, project_dir, data_passing_memory_size
        )


@contextmanager
def launch_noninteractive_session(
    docker_client,
    pipeline_uuid: str,
    project_uuid: str,
    pipeline_path: str,
    project_dir: str,
    data_passing_memory_size: int,
) -> NonInteractiveSession:
    """Launches a non-interactive session for a particular pipeline.

    Args:
        docker_client (docker.client.DockerClient): docker client to
            manage Docker resources.
        pipeline_uuid: UUID of pipeline that the session is started for.
        project_dir: Path to the `project_dir`, which has to be
            mounted into the containers so that the user can interact
            with the files.
        data_passing_memory_size: Size for the "memory-server".

    Yields:
        A Session object that has already launched its resources.

    """
    session = NonInteractiveSession(docker_client, network="orchest")
    session.launch(
        pipeline_uuid,
        project_uuid,
        pipeline_path,
        project_dir,
        data_passing_memory_size,
    )
    try:
        yield session
    finally:
        session.shutdown()


def _get_mounts(
    uuid: str, project_uuid: str, project_dir: str, host_userdir: str
) -> Dict[str, Mount]:
    """Constructs the mounts for all resources.

    Resources refer to the union of all possible resources over all
    types of session objects.

    Args:
        uuid: Some UUID to identify the session with. For interactive
            runs using the pipeline UUID is recommended, for non-
            interactive runs we recommend using the pipeline run UUID.
        project_uuid: UUID of project.
        project_dir: Project directory w.r.t. the host. Needed to
            construct the mounts.
        host_userdir: Path to the userdir on the host


    Returns:
        Mapping from mount name to actual ``docker.types.Mount`` object.
        The return dict looks as follows:
            mounts = {
                'kernelspec': Mount,
                'docker_sock': Mount,
                'project_dir': Mount,
            }

    """
    mounts = {}

    # The `host_userdir` is only passed for interactive runs as those
    # are the only ones that use kernels.
    if host_userdir is not None:
        source_kernelspecs = os.path.join(
            host_userdir, _config.KERNELSPECS_PATH.format(project_uuid=project_uuid)
        )

        mounts["kernelspec"] = Mount(
            target="/usr/local/share/jupyter/kernels",
            source=source_kernelspecs,
            type="bind",
        )

    # By mounting the docker sock it becomes possible for containers
    # to be spawned from inside another container.
    mounts["docker_sock"] = Mount(
        target="/var/run/docker.sock", source="/var/run/docker.sock", type="bind"
    )

    project_dir_target = _config.PROJECT_DIR
    mounts["project_dir"] = Mount(
        target=project_dir_target, source=project_dir, type="bind"
    )

    mounts["temp_volume"] = Mount(
        target=_config.TEMP_DIRECTORY_PATH,
        source=_config.TEMP_VOLUME_NAME.format(uuid=uuid, project_uuid=project_uuid),
        type="volume",
    )

    return mounts


def _get_container_specs(
    uuid: str,
    project_uuid: str,
    pipeline_path: str,
    project_dir: str,
    host_userdir: str,
    network: str,
    data_passing_memory_size: int,
) -> Dict[str, dict]:
    """Constructs the container specifications for all resources.

    These specifications can be unpacked into the
    ``docker.client.DockerClient.containers.run`` method.

    Args:
        uuid: Some UUID to identify the session with. For interactive
            runs using the pipeline UUID is recommended, for non-
            interactive runs we recommend using the pipeline run UUID.
        project_uuid: UUID of the project.
        project_dir: Project directory w.r.t. the host. Needed to
            construct the mounts.
        host_userdir: Path to the userdir on the host
        network: Docker network. This is put directly into the specs, so
            that the containers are started on the specified network.
        data_passing_memory_size: Size for the "memory-server".

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
    mounts = _get_mounts(uuid, project_uuid, project_dir, host_userdir)

    # Determine the shm size for the Docker container to be able to
    # allow Plasma to use the requested memory size for data passing.
    # NOTE: The `shm_size` is passed to the Plasma store as well using
    # the `ORCHEST_MEMORY_SIZE` ENV variable, this leads to minor
    # overallocation for the store.
    # TODO: Fix `shm_size` passing to the memory-server once we know the
    # exact conversion between shm-size of Docker and the size of the
    # store.
    shm_size = utils.calculate_shm_size(data_passing_memory_size)
    container_specs["memory-server"] = {
        "image": "orchest/memory-server:latest",
        "detach": True,
        "mounts": [mounts["project_dir"], mounts["temp_volume"]],
        # TODO: name not unique... and uuid cannot be used.
        "name": f"memory-server-{project_uuid}-{uuid}",
        "network": network,
        "shm_size": shm_size,
        "environment": [
            f"ORCHEST_PIPELINE_PATH={pipeline_path}",
            f"ORCHEST_MEMORY_SIZE={shm_size}",
        ],
        # Labels are used to have a way of keeping track of the
        # containers attributes through ``Session.from_container_IDs``
        "labels": {"session_identity_uuid": uuid, "project_uuid": project_uuid},
    }

    # Run EG container, where EG_DOCKER_NETWORK ensures that kernels
    # started by the EG are on the same docker network as the EG.
    gateway_hostname = _config.JUPYTER_EG_SERVER_NAME.format(
        project_uuid=project_uuid[: _config.TRUNCATED_UUID_LENGTH],
        pipeline_uuid=uuid[: _config.TRUNCATED_UUID_LENGTH],
    )

    container_specs["jupyter-EG"] = {
        "image": "orchest/jupyter-enterprise-gateway",  # TODO: make not static.
        "detach": True,
        "mounts": [mounts.get("docker_sock"), mounts.get("kernelspec")],
        "name": gateway_hostname,
        "environment": [
            f"EG_DOCKER_NETWORK={network}",
            "EG_MIRROR_WORKING_DIRS=True",
            "EG_LIST_KERNELS=True",
            "EG_KERNEL_WHITELIST=[]",
            "EG_PROHIBITED_UIDS=[]",
            'EG_UNAUTHORIZED_USERS=["dummy"]',
            'EG_UID_BLACKLIST=["-1"]',
            "EG_ALLOW_ORIGIN=*",
            "EG_ENV_PROCESS_WHITELIST=ORCHEST_PIPELINE_UUID,ORCHEST_PIPELINE_PATH,ORCHEST_PROJECT_UUID,ORCHEST_HOST_PROJECT_DIR",
            f"ORCHEST_PIPELINE_UUID={uuid}",
            f"ORCHEST_PIPELINE_PATH={pipeline_path}",
            f"ORCHEST_PROJECT_UUID={project_uuid}",
            f"ORCHEST_HOST_PROJECT_DIR={project_dir}",
        ],
        "user": "root",
        "network": network,
        # Labels are used to have a way of keeping track of the
        # containers attributes through ``Session.from_container_IDs``
        "labels": {"session_identity_uuid": uuid, "project_uuid": project_uuid},
    }

    jupyter_hostname = _config.JUPYTER_SERVER_NAME.format(
        project_uuid=project_uuid[: _config.TRUNCATED_UUID_LENGTH],
        pipeline_uuid=uuid[: _config.TRUNCATED_UUID_LENGTH],
    )
    # Run Jupyter server container.
    container_specs["jupyter-server"] = {
        "image": "orchest/jupyter-server:latest",  # TODO: make not static.
        "detach": True,
        "mounts": [mounts["project_dir"]],
        "name": jupyter_hostname,
        "network": network,
        "environment": ["KERNEL_UID=0"],
        "command": [
            "--allow-root",
            "--port=8888",
            "--no-browser",
            "--debug",
            f"--gateway-url={'http://' + gateway_hostname}:8888",
            f"--notebook-dir={_config.PROJECT_DIR}",
            f"--ServerApp.base_url=/{jupyter_hostname}",
        ],
        # Labels are used to have a way of keeping track of the
        # containers attributes through ``Session.from_container_IDs``
        "labels": {"session_identity_uuid": uuid, "project_uuid": project_uuid},
    }

    return container_specs
