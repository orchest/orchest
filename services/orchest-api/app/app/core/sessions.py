import json
import logging
import os
import socket
import time
import traceback
from abc import abstractmethod
from contextlib import contextmanager
from enum import Enum
from typing import Any, Dict, NamedTuple, Optional
from uuid import uuid4

import docker
import requests
from docker.errors import APIError, ContainerError, NotFound
from docker.types import LogConfig, Mount

from _orchest.internals import config as _config
from app import errors, utils


class SessionType(Enum):
    INTERACTIVE = "interactive"
    NONINTERACTIVE = "noninteractive"


class IP(NamedTuple):
    jupyter_EG: str
    jupyter_server: str


def _inject_message_as_service(ip, port, service, msg):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.connect((ip, port))
    # TODO: find a way to avoid having to fake being a syslog message.
    msg = f"user-service-{service}-metadata-end[0000]: {msg}"
    sock.send(msg.encode("utf-8"))
    sock.close()


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

    def launch(
        self,
        uuid: str,
        session_config: Dict[str, Any],
        session_type: SessionType,
    ) -> None:
        """Launches pre-configured resources.

        All containers are run in detached mode.

        Args:
            uuid: UUID to identify the session with. It is passed to the
                :meth:`_get_container_specs` method. Meaning `uuid` is
                recommended to be either a pipeline UUID (for
                interactive sessions) or pipeline run UUID (for non-
                interactive sessions).

        """

        # TODO: make convert this "pipeline" uuid into a "session" uuid.
        orchest_services = _get_orchest_services_specs(
            uuid,
            session_config,
            session_type,
            self.network,
        )

        for resource in self._resources:
            try:
                container = self.client.containers.run(**orchest_services[resource])
                self._containers[resource] = container
            except Exception as e:
                logging.error("Failed to start container %s [%s]." % (e, type(e)))
                raise errors.SessionContainerError(
                    "Could not start required containers."
                )

        # Wait for the sidecar to be ready so that all logs are captured
        # , moreover, in TCP mode docker will not start a container if
        # it can't connect to the logger. This is not an health check
        # because an health check would have to run periodically, which
        # is a waste.
        sidecar_c = self._containers["session-sidecar"]
        n = 50
        for _ in range(n):
            exit_code = sidecar_c.exec_run(
                "netstat -plnt | grep ':1111'",
            )[0]
            if exit_code == 0:
                break
            else:
                time.sleep(0.1)
        else:
            raise errors.SessionContainerError("Sidecar not listening.")

        # Using the sidecar ip is necessary because docker won't do name
        # resolution when passing a name to the log-driver.
        sidecar_ip = self._get_container_IP(sidecar_c)
        user_services = _get_services_specs(
            uuid,
            session_config,
            session_type,
            f"tcp://{sidecar_ip}:1111",
            self.network,
        )

        for service_name, service_spec in user_services.items():
            try:
                container = self.client.containers.run(**service_spec)
                self._containers[service_name] = container
            except Exception as e:
                logging.error(
                    "Failed to start user service container %s [%s]." % (e, type(e))
                )
                try:
                    container = self.client.containers.get(service_spec["name"])
                    container.remove(force=True)
                except NotFound:
                    logging.warning("Did not find dangling user service container.")

                # Necessary because the docker container won't emit any
                # logs for SDK level errors.
                _inject_message_as_service(
                    sidecar_ip,
                    1111,
                    service_name,
                    e.explanation if isinstance(e, APIError) else str(e),
                )

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

        for _, container in self.containers.items():
            # TODO: this depends on whether or not auto_remove is
            # enabled in the container specs.

            # We are relying on the fact that the session_identity_uuid
            # and project_uuid are consistent among these containers,
            # i.e. there is 1 of each.
            if session_identity_uuid is None:
                session_identity_uuid = container.labels.get("session_identity_uuid")
            if project_uuid is None:
                project_uuid = container.labels.get("project_uuid")

            # Catch to take care of the race condition where a session
            # is already shutting down on its own but a shutdown command
            # is issued by a project/pipeline/exp deletion at the same
            # time.
            try:
                container.remove(force=True)
            except (
                requests.exceptions.HTTPError,
                NotFound,
                APIError,
                ContainerError,
            ) as e:
                logging.error(
                    "Failed to kill/remove session container %s [%s]" % (e, type(e))
                )

        # The reasons such removal needs to be done in sessions.py
        # instead of pipelines.py are: 1) in a job run, the memory
        # server is the last container that is removed, that happens
        # when the session is shutting down, before that happens the TMP
        # volume(s) cannot be removed 2) this way we also cleanup the
        # volumes of an interactive session when the session shuts down.
        if session_identity_uuid is not None and project_uuid is not None:
            volume = self.client.volumes.get(
                _config.TEMP_VOLUME_NAME.format(
                    uuid=session_identity_uuid, project_uuid=project_uuid
                )
            )
            # Catch to take care of the race condition where a session
            # is already shutting down on its own but a shutdown command
            # is issued by a project/pipeline/exp deletion at the same
            # time.
            try:
                volume.remove()
            except (requests.exceptions.HTTPError, NotFound, APIError):
                pass

        return


class InteractiveSession(Session):
    """Manages resources for an interactive session."""

    _resources = [
        "memory-server",
        "session-sidecar",
        "jupyter-EG",
        "jupyter-server",
    ]

    def __init__(self, client, network=None):
        super().__init__(client, network)

        self._notebook_server_info = None

    @property
    def notebook_server_info(self):
        """The information to connect to the notebook server."""
        # TODO: maybe error if launch was not called yet
        if self._notebook_server_info is None:
            pass

        return self._notebook_server_info

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

    def launch(self, session_config: Dict[str, Any]) -> None:
        """Launches the interactive session.

        Additionally connects the launched `jupyter-server` with the
        `jupyter-enterprise-gateway` (shot `jupyter-EG`).

        Args:
            See `Args` section in parent class :class:`Session`.

        """
        super().launch(
            session_config["pipeline_uuid"],
            session_config,
            session_type=SessionType.INTERACTIVE,
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
                project_uuid=session_config["project_uuid"][
                    : _config.TRUNCATED_UUID_LENGTH
                ],
                pipeline_uuid=session_config["pipeline_uuid"][
                    : _config.TRUNCATED_UUID_LENGTH
                ],
            ),
        }

        # Poll jupyter_server until available
        url = (
            f"http://{IP.jupyter_server}"
            f":8888{self._notebook_server_info['base_url']}/api"
        )

        # Wait for at most 1 minute
        for _ in range(120):
            try:
                requests.get(url, timeout=0.5)
            except (requests.ConnectionError, requests.Timeout):
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
        "session-sidecar",
    ]

    def __init__(self, client, network=None):
        super().__init__(client, network)

        self._session_uuid = str(uuid4())

    def launch(
        self,
        uuid: Optional[str],
        session_config: Dict,
    ) -> None:
        """

        Since multiple memory-servers are started for the same pipeline,
        since their can be multiple pipeline runs, every pipeline run
        and therefore session needs to have a unique docker container
        name for its memory-server.

        Args:
            uuid: Some UUID. If ``None`` then a randomly generated UUID
                is used.

        """
        if uuid is None:
            uuid = self._session_uuid

        return super().launch(
            uuid,
            session_config,
            SessionType.NONINTERACTIVE,
        )


@contextmanager
def launch_noninteractive_session(
    docker_client, session_config: Dict[str, Any]
) -> NonInteractiveSession:
    """Launches a non-interactive session for a particular pipeline.

    Args:
        docker_client (docker.client.DockerClient): docker client to
            manage Docker resources.

    Yields:
        A Session object that has already launched its resources.

    """
    session = NonInteractiveSession(docker_client, network=_config.DOCKER_NETWORK)
    session.launch(None, session_config)
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
                'temp_volume': Mount,

                # Used for persisting user configurations.
                'jupyterlab': {
                    'lab': Mount,
                    'user_settings': Mount,
                },
            }

    """
    mounts = {}

    # The `host_userdir` is only passed for interactive runs.
    if host_userdir is not None:
        source_kernelspecs = os.path.join(
            host_userdir, _config.KERNELSPECS_PATH.format(project_uuid=project_uuid)
        )
        mounts["kernelspec"] = Mount(
            target="/usr/local/share/jupyter/kernels",
            source=source_kernelspecs,
            type="bind",
        )

        # User configurations of the JupyterLab IDE.
        mounts["jupyterlab"] = {}
        mounts["jupyterlab"]["lab"] = Mount(  # extensions
            target="/usr/local/share/jupyter/lab",
            source=os.path.join(
                host_userdir, ".orchest/user-configurations/jupyterlab/lab"
            ),
            type="bind",
        )
        mounts["jupyterlab"]["user-settings"] = Mount(  # settings
            target="/root/.jupyter/lab/user-settings",
            source=os.path.join(
                host_userdir, ".orchest/user-configurations/jupyterlab/user-settings"
            ),
            type="bind",
        )

        mounts["jupyterlab"]["data"] = Mount(  # data directory
            target="/data",
            source=os.path.join(host_userdir, "data"),
            type="bind",
        )
    else:
        # For non-interactive runs, make sure that the same set of keys
        # is available in the mounts dictionary.
        mounts["kernelspec"] = None
        mounts["jupyterlab"] = {}

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


def _get_services_specs(
    uuid: str,
    session_config: Optional[Dict[str, Any]],
    session_type: SessionType,
    sidecar_address,
    network: str,
) -> Dict[str, Any]:
    """Constructs the container specifications for all services.

    These specifications can be unpacked into the
    ``docker.client.DockerClient.containers.run`` method.

    Args:
        uuid: Some UUID to identify the session with. For interactive
            runs using the pipeline UUID is required, for non-
            interactive runs we recommend using the pipeline run UUID.
        session_type: Type of session: interactive, or noninteractive,
        network: Docker network. This is put directly into the specs, so
            that the containers are started on the specified network.

    Returns:
        Mapping from container name to container specification for the
        run method. The return dict looks as follows:
            container_specs = {
                'service-*': spec dict,
                ...
            }

    """
    project_uuid = session_config["project_uuid"]
    pipeline_uuid = session_config["pipeline_uuid"]
    project_dir = session_config["project_dir"]
    host_userdir = session_config["host_userdir"]
    services = session_config["services"]

    specs = {}

    for service_name, service in services.items():

        # Skip if a scope is defined, and doesn't match session_type
        if "scope" in service and session_type.value not in service["scope"]:
            continue

        container_name = (
            f"service-{service_name}"
            f'-{project_uuid.split("-")[0]}-{uuid.split("-")[0]}'
        )
        service_base_url = f"/{container_name}"

        # Replace $BASE_PATH_PREFIX with service_base_url.
        # NOTE: this substitution happens after
        # service["name"] is read, so that JSON entry
        # does not support $BASE_PATH_PREFIX substitution.
        service_str = json.dumps(service)
        service_str = service_str.replace("$BASE_PATH_PREFIX", service_base_url)
        service = json.loads(service_str)

        # Get user configured environment variables
        try:
            if session_type == SessionType.NONINTERACTIVE:
                # Get job environment variable overrides
                user_env_variables = session_config["user_env_variables"]
            else:
                user_env_variables = utils.get_proj_pip_env_variables(
                    project_uuid, pipeline_uuid
                )
        except Exception as e:

            logging.error("Failed to fetch user_env_variables: %s [%s]" % (e, type(e)))

            traceback.print_exc()

            user_env_variables = {}

        environment = {}

        for inherited_key in service.get("environment_inherit", []):
            if inherited_key in user_env_variables:
                environment[inherited_key] = user_env_variables[inherited_key]

        # User defined env vars superse inherited ones.
        environment = environment.update(service.get("environment", {}))

        mounts = []
        sbinds = service["binds"]
        # Can be later extended into adding a Mount for every "custom"
        # key, e.g. key != data and key != project_directory.
        if "data" in sbinds:
            mounts.append(
                Mount(  # data directory
                    target=sbinds["data"],
                    source=os.path.join(host_userdir, "data"),
                    type="bind",
                ),
            )

        if "project_directory" in sbinds:
            mounts.append(
                Mount(
                    target=sbinds["project_directory"],
                    source=project_dir,
                    type="bind",
                ),
            )
        specs[service_name] = {
            "image": service["image"],
            "detach": True,
            "mounts": mounts,
            "name": container_name,
            "network": network,
            "environment": environment,
            # Labels are used to have a way of keeping track of the
            # containers attributes through
            # ``Session.from_container_IDs``
            "labels": {
                "session_identity_uuid": uuid,
                "project_uuid": project_uuid,
            },
            "log_config": LogConfig(
                type=LogConfig.types.SYSLOG,
                config={
                    "mode": "non-blocking",
                    "max-buffer-size": "10mb",
                    "syslog-format": "rfc3164",
                    "syslog-address": sidecar_address,
                    # Used by the sidecar to detect who is sending logs.
                    "tag": f"user-service-{service_name}-metadata-end",
                },
            ),
        }

        if "entrypoint" in service:
            specs[service_name]["entrypoint"] = service["entrypoint"]

        if "command" in service:
            specs[service_name]["command"] = service["command"]

    return specs


def _get_orchest_services_specs(
    uuid: str,
    session_config: Dict[str, Any],
    session_type: SessionType,
    network: str,
) -> Dict[str, dict]:
    """Constructs the container specifications for all resources.

    These specifications can be unpacked into the
    ``docker.client.DockerClient.containers.run`` method.

    Args:
        uuid: Some UUID to identify the session with. For interactive
            runs using the pipeline UUID is required, for non-
            interactive runs we recommend using the pipeline run UUID.
        session_type: Type of session: interactive, or noninteractive,
        network: Docker network. This is put directly into the specs, so
            that the containers are started on the specified network.

    Returns:
        Mapping from container name to container specification for the
        run method. The return dict looks as follows:
            container_specs = {
                'memory-server': spec dict,
                'session-sidecar': spec dict,
                'jupyter-EG': spec dict,
                'jupyter-server': spec dict,
            }

    """

    project_uuid = session_config["project_uuid"]
    pipeline_uuid = session_config["pipeline_uuid"]
    pipeline_path = session_config["pipeline_path"]
    project_dir = session_config["project_dir"]
    host_userdir = session_config["host_userdir"]

    # TODO: possibly add ``auto_remove=True`` to the specs.
    orchest_services_specs = {}
    mounts = _get_mounts(uuid, project_uuid, project_dir, host_userdir)

    orchest_services_specs["memory-server"] = {
        "image": "orchest/memory-server:latest",
        "detach": True,
        "mounts": [mounts["project_dir"], mounts["temp_volume"]],
        "name": f"memory-server-{project_uuid}-{uuid}",
        "network": network,
        # Set a ridiculous shm size and let plasma determine how much
        # it wants to consume (according to the setting in the pipeline
        # definition). Mounting `/dev/shm` directly is not supported on
        # Mac.
        "shm_size": "1000G",
        "environment": [
            f"ORCHEST_PIPELINE_PATH={pipeline_path}",
        ],
        # Labels are used to have a way of keeping track of the
        # containers attributes through ``Session.from_container_IDs``
        "labels": {"session_identity_uuid": uuid, "project_uuid": project_uuid},
    }

    orchest_services_specs["session-sidecar"] = {
        "image": "orchest/session-sidecar:latest",
        "detach": True,
        "mounts": [mounts["project_dir"]],
        "name": f"session-sidecar-{project_uuid}-{uuid}",
        # It will try to create the logs directory for a given run if it
        # does not exist, so this is needed to avoid permission issues.
        "group_add": [os.environ.get("ORCHEST_HOST_GID")],
        "network": network,
        "environment": [
            f"ORCHEST_PIPELINE_UUID={pipeline_uuid}",
        ],
        "labels": {"session_identity_uuid": uuid, "project_uuid": project_uuid},
    }

    # Run EG container, where EG_DOCKER_NETWORK ensures that kernels
    # started by the EG are on the same docker network as the EG.
    gateway_hostname = _config.JUPYTER_EG_SERVER_NAME.format(
        project_uuid=project_uuid[: _config.TRUNCATED_UUID_LENGTH],
        pipeline_uuid=uuid[: _config.TRUNCATED_UUID_LENGTH],
    )

    # Get user configured environment variables for EG,
    # to pass to Jupyter kernels.
    try:
        env_variables = utils.get_proj_pip_env_variables(project_uuid, pipeline_uuid)
    except Exception:
        env_variables = {}

    user_defined_env_vars = [f"{key}={value}" for key, value in env_variables.items()]

    process_env_whitelist = (
        "EG_ENV_PROCESS_WHITELIST=ORCHEST_PIPELINE_UUID,"
        "ORCHEST_PIPELINE_PATH,"
        "ORCHEST_PROJECT_UUID,"
        "ORCHEST_HOST_PROJECT_DIR,"
        "ORCHEST_HOST_GID,"
    )
    process_env_whitelist += ",".join([key for key in env_variables.keys()])

    if session_type == SessionType.INTERACTIVE:
        orchest_services_specs["jupyter-EG"] = {
            "image": "orchest/jupyter-enterprise-gateway",
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
                process_env_whitelist,
                f"ORCHEST_PIPELINE_UUID={pipeline_uuid}",
                f"ORCHEST_PIPELINE_PATH={pipeline_path}",
                f"ORCHEST_PROJECT_UUID={project_uuid}",
                f"ORCHEST_HOST_PROJECT_DIR={project_dir}",
                f'ORCHEST_HOST_GID={os.environ.get("ORCHEST_HOST_GID")}',
            ]
            + user_defined_env_vars,
            "user": "root",
            "network": network,
            # Labels are used to have a way of keeping track of the
            # containers attributes through
            # ``Session.from_container_IDs``
            "labels": {"session_identity_uuid": uuid, "project_uuid": project_uuid},
        }

        jupyter_hostname = _config.JUPYTER_SERVER_NAME.format(
            project_uuid=project_uuid[: _config.TRUNCATED_UUID_LENGTH],
            pipeline_uuid=uuid[: _config.TRUNCATED_UUID_LENGTH],
        )

        jupyer_server_image = "orchest/jupyter-server:latest"

        # Check if user tweaked JupyterLab image exists
        user_jupyer_server_image = _config.JUPYTER_IMAGE_NAME
        if utils.get_environment_image_docker_id(user_jupyer_server_image) is not None:
            jupyer_server_image = user_jupyer_server_image

        # Run Jupyter server container.
        orchest_services_specs["jupyter-server"] = {
            "image": jupyer_server_image,
            "detach": True,
            "mounts": [
                mounts["project_dir"],
                mounts["jupyterlab"].get("lab"),
                mounts["jupyterlab"].get("user-settings"),
                mounts["jupyterlab"].get("data"),
            ],
            "name": jupyter_hostname,
            "network": network,
            "group_add": [os.environ.get("ORCHEST_HOST_GID")],
            "command": [
                "--allow-root",
                "--port=8888",
                "--no-browser",
                f"--gateway-url={'http://' + gateway_hostname}:8888",
                f"--notebook-dir={_config.PROJECT_DIR}",
                f"--ServerApp.base_url=/{jupyter_hostname}",
            ],
            # Labels are used to have a way of keeping track of the
            # containers attributes through
            # ``Session.from_container_IDs``
            "labels": {"session_identity_uuid": uuid, "project_uuid": project_uuid},
        }

    return orchest_services_specs
