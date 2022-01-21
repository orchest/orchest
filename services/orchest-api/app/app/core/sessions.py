import json
import os
import traceback
from contextlib import contextmanager
from enum import Enum
from typing import Any, Dict, NamedTuple, Optional

from docker.types import LogConfig, Mount

from _orchest.internals import config as _config
from _orchest.internals.utils import get_k8s_namespace_name
from app import utils
from app.connections import k8s_apps_api, k8s_core_api
from config import CONFIG_CLASS


class SessionType(Enum):
    INTERACTIVE = "interactive"
    NONINTERACTIVE = "noninteractive"


class IP(NamedTuple):
    jupyter_EG: str
    jupyter_server: str


class Session:
    """Manages resources for a session.


    A session is used to launch and shutdown particular resources. Every
    session manages a k8s namespace in which it will create all its
    resources, currently, this means:

    - internal orchest services
    - user orchest services

    For each of those, a k8s deployment and k8s service are created.
    Internal orchest services are hardcoded within the class, user
    orchest services are passed on initialization.

    """

    def __init__(
        self,
        pipeline_or_run_uuid: str,
        session_config: Dict[str, Any],
        session_type: SessionType,
    ):
        """
        Args:
            uuid: UUID to identify the session with. It is passed to the
                :meth:`_get_container_specs` method. Meaning `uuid` is
                recommended to be either a pipeline UUID (for
                interactive sessions) or pipeline run UUID (for non-
                interactive sessions).
            session_config: A dictionary containing the session
                configuration. Required entries: project_uuid,
                pipeline_uuid , project_dir, host_userdir,
                env_uuid_docker_id_mappings.  user_env_variables is a
                required entry for noninteractive session type, while
                it's unusued for interactive session type.  User
                services can be defined by passing the optional entry
                services, a dictionary mapping service names to service
                configurations. Each service is considered a "user
                service" and will be launched along with the minimum
                resources that are required by a session to run. The
                project_uuid and pipeline_uuid determine the name of the
                resources that are launched, i.e. the container names
                are based on those. The image of a service can be an
                "external" image to be pulled from a repo or an orchest
                environment image uuid prefixed by environment@, in the
                latter case, the used image depends on the
                env_uuid_docker_id_mappings, which must have an entry
                for said environment uuid.  Example of a configuration:
                {
                    "project_uuid": myuuid,
                    "pipeline_uuid": myuuid,
                    "project_dir": mystring,
                    "host_userdir": mystring,
                    "user_env_variables": {
                        "A": "1",
                        "B": "hello"
                    }
                    "env_uuid_docker_id_mappings" : {
                        "env uuid" : "docker id"
                    }
                    "services": {
                        "my-little-service": {
                            "name": "my-little-service",
                            "binds": {
                                "/data": "/data",
                                "/project-dir": "/project-dir"
                            },
                            "image": "myimage",
                            "command": "mycommand",
                            "entrypoint": "myentrypoint",
                            "scope": ["interactive", "noninteractive"],
                            "ports": [80, 8080], // ports are TCP only,
                            "env_variables": {
                                "key1": "value1",
                                "key2": "value2"
                            },
                            "env_variables_inherit": ["key1", "key2"],
                        }}
                }
            session_type: Type of session: interactive, or
                noninteractive.
        """
        self.pipeline_or_run_uuid = pipeline_or_run_uuid
        self._session_config = session_config
        self._session_type = session_type

    def launch(self):
        # logger = utils.get_logger()
        project_uuid = self._session_config["project_uuid"]
        utils.create_namespace(project_uuid, self.pipeline_or_run_uuid)

        # Internal Orchest session services.
        deployment_manifests = [
            Session._get_memory_server_deployment_manifest(
                self.pipeline_or_run_uuid, self._session_config, self._session_type
            ),
            Session._get_session_sidecar_deployment_manifest(
                self.pipeline_or_run_uuid, self._session_config, self._session_type
            ),
        ]

        # Wait for orchest services to be ready. User services might
        # depend on them.

        for manifest in deployment_manifests:
            k8s_apps_api.create_namespaced_deployment(
                get_k8s_namespace_name(project_uuid, self.pipeline_or_run_uuid),
                manifest,
            )

    def shutdown(self):
        """Shutdowns the session, deleting all related resources."""
        k8s_core_api.delete_namespace(
            get_k8s_namespace_name(
                self._session_config["project_uuid"], self.pipeline_or_run_uuid
            ),
        )
        # K8S_TODO: delete dangling environment images.

    def restart_resource(self, service_name="memory-server"):
        """Restarts a session service by name.

        Especially for the `memory-server` this comes in handy. Because
        the user should be able to clear the server. Which internally we
        do by restarting it, since clearing would also lose all state.
        Note that restarting the `memory-server` resets its eviction
        state, which is exactly what we want.

        """
        ...

    @classmethod
    def _get_memory_server_deployment_manifest(
        cls,
        pipeline_or_run_uuid: str,
        session_config: str,
        session_type: SessionType,
    ) -> dict:
        project_uuid = session_config["project_uuid"]
        pipeline_uuid = session_config["pipeline_uuid"]
        host_pipeline_path = session_config["pipeline_path"]
        host_project_dir = session_config["project_dir"]
        host_userdir = session_config["host_userdir"]

        metadata = {
            "name": "memory-server",
            "labels": {
                "app": "memory-server",
                "project_uuid": project_uuid,
                "pipeline_or_run_uuid": pipeline_or_run_uuid,
            },
        }
        volumes_dict = _get_volumes(
            project_uuid, host_project_dir, host_pipeline_path, host_userdir
        )
        volume_mounts_dict = _get_volume_mounts(
            _config.PROJECT_DIR, _config.PIPELINE_FILE, session_type
        )
        return {
            "apiVersion": "apps/v1",
            "kind": "Deployment",
            "metadata": metadata,
            "spec": {
                "replicas": 1,
                "selector": {"matchLabels": {"app": "memory-server"}},
                "template": {
                    "metadata": metadata,
                    "spec": {
                        "securityContext": {
                            "runAsUser": 0,
                            "runAsGroup": int(os.environ.get("ORCHEST_HOST_GID")),
                            "fsGroup": int(os.environ.get("ORCHEST_HOST_GID")),
                        },
                        "resources": {
                            "requests": {"cpu": _config.USER_CONTAINERS_CPU_SHARES}
                        },
                        "volumes": [
                            volumes_dict["project-dir"],
                            volumes_dict["pipeline-file"],
                            {"name": "dev-shm", "emptyDir": {"medium": "Memory"}},
                        ],
                        "containers": [
                            {
                                "name": "memory-server",
                                "image": "orchest/memory-server:latest",
                                # K8S_TODO: fix me.
                                "imagePullPolicy": "IfNotPresent",
                                "env": [
                                    {
                                        "name": "ORCHEST_PROJECT_UUID",
                                        "value": project_uuid,
                                    },
                                    {
                                        "name": "ORCHEST_PIPELINE_UUID",
                                        "value": pipeline_uuid,
                                    },
                                    {
                                        "name": "ORCHEST_PIPELINE_PATH",
                                        "value": _config.PIPELINE_FILE,
                                    },
                                    {
                                        "name": "ORCHEST_SESSION_UUID",
                                        "value": pipeline_or_run_uuid,
                                    },
                                    {
                                        "name": "ORCHEST_SESSION_TYPE",
                                        "value": session_type.value,
                                    },
                                ],
                                "volumeMounts": [
                                    volume_mounts_dict["pipeline-file"],
                                    volume_mounts_dict["project-dir"],
                                    {"name": "dev-shm", "mountPath": "/dev/shm"},
                                ],
                            }
                        ],
                    },
                },
            },
        }

    @classmethod
    def _get_session_sidecar_deployment_manifest(
        cls,
        pipeline_or_run_uuid: str,
        session_config: str,
        session_type: SessionType,
    ) -> dict:
        project_uuid = session_config["project_uuid"]
        pipeline_uuid = session_config["pipeline_uuid"]
        host_pipeline_path = session_config["pipeline_path"]
        host_project_dir = session_config["project_dir"]
        host_userdir = session_config["host_userdir"]

        metadata = {
            "name": "session-sidecar",
            "labels": {
                "app": "session-sidecar",
                "project_uuid": project_uuid,
                "pipeline_or_run_uuid": pipeline_or_run_uuid,
            },
        }
        volumes_dict = _get_volumes(
            project_uuid, host_project_dir, host_pipeline_path, host_userdir
        )
        volume_mounts_dict = _get_volume_mounts(
            _config.PROJECT_DIR, _config.PIPELINE_FILE, session_type
        )
        return {
            "apiVersion": "apps/v1",
            "kind": "Deployment",
            "metadata": metadata,
            "spec": {
                "replicas": 1,
                "selector": {"matchLabels": {"app": metadata["name"]}},
                "template": {
                    "metadata": metadata,
                    "spec": {
                        "securityContext": {
                            "runAsUser": 0,
                            "runAsGroup": int(os.environ.get("ORCHEST_HOST_GID")),
                            "fsGroup": int(os.environ.get("ORCHEST_HOST_GID")),
                        },
                        "resources": {
                            "requests": {"cpu": _config.USER_CONTAINERS_CPU_SHARES}
                        },
                        "volumes": [
                            volumes_dict["project-dir"],
                        ],
                        "containers": [
                            {
                                "name": metadata["name"],
                                "image": "orchest/session-sidecar:latest",
                                # K8S_TODO: fix me.
                                "imagePullPolicy": "IfNotPresent",
                                "env": [
                                    {
                                        "name": "ORCHEST_PROJECT_UUID",
                                        "value": project_uuid,
                                    },
                                    {
                                        "name": "ORCHEST_PIPELINE_UUID",
                                        "value": pipeline_uuid,
                                    },
                                    {
                                        "name": "ORCHEST_SESSION_UUID",
                                        "value": pipeline_or_run_uuid,
                                    },
                                    {
                                        "name": "ORCHEST_SESSION_TYPE",
                                        "value": session_type.value,
                                    },
                                ],
                                "volumeMounts": [
                                    volume_mounts_dict["project-dir"],
                                ],
                            }
                        ],
                    },
                },
            },
        }


class InteractiveSession(Session):
    def __init__(self, pipeline_or_run_uuid: str, session_config: Dict[str, Any]):
        super().__init__(pipeline_or_run_uuid, session_config, SessionType.INTERACTIVE)

    def has_busy_kernels(self, session_config: Dict[str, Any]) -> bool:
        """Tells if the session has busy kernels.

        Args:
            session_config: Requires a "project_uuid" and a
            "pipeline_uuid".

        #"""
        return False
        # IP = self.get_containers_IP()

        # if self._notebook_server_info is None:
        #     self._notebook_server_info = {
        #         "port": 8888,
        #         "base_url": "/"
        #         + _config.JUPYTER_SERVER_NAME.format(
        #             project_uuid=session_config["project_uuid"][
        #                 : _config.TRUNCATED_UUID_LENGTH
        #             ],
        #             pipeline_uuid=session_config["pipeline_uuid"][
        #                 : _config.TRUNCATED_UUID_LENGTH
        #             ],
        #         ),
        #     }

        # https://jupyter-server.readthedocs.io/en/latest/developers/rest-api.html
        # url = (
        #     f"http://{IP.jupyter_server}"
        #     f":8888{self._notebook_server_info['base_url']}/api/kernels"
        # )
        # response = requests.get(url, timeout=2.0)

        # # Expected format: a list of dictionaries.
        # # [{'id': '3af6f3b9-4358-43b9-b2dd-03b51c4f7881', 'name':
        # # 'orchest-kernel-c56ab762-539c-4cce-9b1e-c4b00300ec6f',
        # # 'last_activity': '2021-11-10T09:04:10.508031Z',
        # # 'execution_state': 'idle', 'connections': 2}]
        # kernels: List[dict] = response.json()
        # return any(
        # kernel.get("execution_state") == "busy" for kernel in kernels)


class NonInteractiveSession(Session):
    def __init__(self, pipeline_or_run_uuid: str, session_config: Dict[str, Any]):
        super().__init__(
            pipeline_or_run_uuid, session_config, SessionType.NONINTERACTIVE
        )


@contextmanager
def launch_noninteractive_session(
    uuid: str, session_config: Dict[str, Any]
) -> NonInteractiveSession:
    """Launches a non-interactive session for a particular pipeline.

    Args:
        See `Args` section in class :class:`NonInteractiveSession`.
        docker_client (docker.client.DockerClient): docker client to
            manage Docker resources.

    Yields:
        A Session object that has already launched its resources, set
        in NONINTERacti mode.

    """
    session = NonInteractiveSession(uuid, session_config)
    try:
        session.launch()
        yield session
    finally:
        session.shutdown()


def _get_volumes(
    project_uuid: str,
    host_project_dir: str,
    host_pipeline_path: str,
    host_userdir: str,
) -> Dict[str, Dict]:
    # Make sure the same set of keys is available for all cases.
    volumes = {
        "kernelspec": None,
        "jupyterlab-lab": None,
        "jupyterlab-user-settings": None,
        "jupyterlab-data": None,
    }

    # K8S_TODO: we are not mounting the docker sock anymore since aren't
    # spawning containers from other containers. Is there something else
    # we should pass?

    volumes["project-dir"] = {
        "name": "project-dir",
        "hostPath": {"path": host_project_dir},
    }
    volumes["pipeline-file"] = {
        "name": "pipeline-file",
        "hostPath": {"path": os.path.join(host_project_dir, host_pipeline_path)},
    }

    # The `host_userdir` is only passed for interactive runs.
    if host_userdir is not None:
        source_kernelspecs = os.path.join(
            host_userdir, _config.KERNELSPECS_PATH.format(project_uuid=project_uuid)
        )
        volumes["kernelspec"] = {
            "name": "kernelspec",
            "hostPath": {"path": source_kernelspecs},
        }

        # User configurations of the JupyterLab IDE.
        volumes["jupyterlab-lab"] = {
            "name": "jupyterlab-lab",
            "hostPath": {
                "path": os.path.join(
                    host_userdir, ".orchest/user-configurations/jupyterlab/lab"
                ),
            },
        }
        volumes["jupyterlab-user-settings"] = {
            "name": "jupyterlab-user-settings",
            "hostPath": {
                "path": os.path.join(
                    host_userdir,
                    ".orchest/user-configurations/jupyterlab/user-settings",
                ),
            },
        }
        volumes["jupyterlab-data"] = {
            "name": "jupyterlab-data",
            "hostPath": {
                "path": os.path.join(host_userdir, "data"),
            },
        }

    return volumes


def _get_volume_mounts(
    container_project_dir: str, container_pipeline_path: str, session_type: SessionType
) -> Dict[str, Dict]:
    # Make sure the same set of keys is available for all cases.
    volumes_mounts = {
        "kernelspec": None,
        "jupyterlab-lab": None,
        "jupyterlab-user-settings": None,
        "jupyterlab-data": None,
    }

    # K8S_TODO: we are not mounting the docker sock anymore since aren't
    # spawning containers from other containers. Is there something else
    # we should pass?

    volumes_mounts["project-dir"] = {
        "name": "project-dir",
        "mountPath": container_project_dir,
    }
    volumes_mounts["pipeline-file"] = {
        "name": "pipeline-file",
        "mountPath": container_pipeline_path,
    }

    # The `host_userdir` is only passed for interactive runs.
    if session_type == SessionType.INTERACTIVE:
        volumes_mounts["kernelspec"] = {
            "name": "kernelspec",
            "mountPath": "/usr/local/share/jupyter/kernels",
        }

        volumes_mounts["jupyterlab-lab"] = {
            "name": "jupyterlab-lab",
            "mountPath": "/usr/local/share/jupyter/lab",
        }

        volumes_mounts["jupyterlab-user-settings"] = {
            "name": "jupyterlab-user-settings",
            "mountPath": "/root/.jupyter/lab/user-settings",
        }

        volumes_mounts["jupyterlab-data"] = {
            "name": "jupyterlab-data",
            "mountPath": "/data",
        }

    return volumes_mounts


def _get_user_services_specs(
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
        session_config: See `Args` section in class :class:`Session`.
        session_type: Type of session: interactive, or noninteractive,
        sidecar_address: Address of the sidecar container, to be passed
            to the log driver for collecting logs. Note that docker does
            not provide host name resolution for containers in the log
            driver, meaning that passing an address like
            tcp://{container name}:1111, will not work. If you want to
            reach a container within the same docker network you will
            have to pass the ip, tcp://{ip}:1111. External hosts can be
            reached normally, e.g. as if trying to reach them from the
            actual hosts, i.e.  pass the address normally.
        network: Docker network. This is put directly into the specs, so
            that the containers are started on the specified network.

    Returns:
        Mapping from container name to container specification for the
        run method. The return dict looks as follows:
            container_specs = {
                '{service name} spec dict,
                ...
            }

    """
    project_uuid = session_config["project_uuid"]
    pipeline_uuid = session_config["pipeline_uuid"]
    project_dir = session_config["project_dir"]
    # pipeline_path = session_config["pipeline_path"]
    host_userdir = session_config["host_userdir"]
    services = session_config.get("services", {})
    img_mappings = session_config["env_uuid_docker_id_mappings"]

    # orc_mounts = _get_mounts(
    #     uuid, project_uuid, project_dir, pipeline_path, host_userdir
    # )

    specs = {}

    for service_name, service in services.items():

        # Skip if service_scope does not include this type of session.
        if session_type.value not in service["scope"]:
            continue

        container_name = (
            f"service-{service_name}"
            f'-{project_uuid.split("-")[0]}-{uuid.split("-")[0]}'
        )
        # This way nginx won't match & proxy to it.
        if not service.get("ports", []):
            container_name = f"internal-{container_name}"
        else:
            # To preserve the base path when proxying, for more details
            # check the nginx config, services section.
            pbp = "pbp-" if service.get("preserve_base_path", False) else ""
            service_base_url = f"/{pbp}{container_name}"

            # Replace $BASE_PATH_PREFIX with service_base_url.  NOTE:
            # this substitution happens after service["name"] is read,
            # so that JSON entry does not support $BASE_PATH_PREFIX
            # substitution.  This allows the user to specify
            # $BASE_PATH_PREFIX as the value of an env variable, so that
            # the base path can be passsed dynamically to the service.
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

            utils.get_logger().error(
                "Failed to fetch user_env_variables: %s [%s]" % (e, type(e))
            )

            traceback.print_exc()

            user_env_variables = {}

        environment = service.get("env_variables", {})

        # Inherited env vars supersede inherited ones.
        for inherited_key in service.get("env_variables_inherit", []):
            if inherited_key in user_env_variables:
                environment[inherited_key] = user_env_variables[inherited_key]

        # These are all required for the Orchest SDK to work.
        environment["ORCHEST_PROJECT_UUID"] = project_uuid
        environment["ORCHEST_PIPELINE_UUID"] = pipeline_uuid
        # So that the SDK can access the pipeline file.
        environment["ORCHEST_PIPELINE_PATH"] = _config.PIPELINE_FILE
        environment["ORCHEST_SESSION_UUID"] = uuid
        environment["ORCHEST_SESSION_TYPE"] = session_type.value

        # mounts = [orc_mounts["pipeline_file"]]
        mounts = []

        sbinds = service.get("binds", {})
        # Can be later extended into adding a Mount for every "custom"
        # key, e.g. key != data and key != project_directory.
        if "/data" in sbinds:
            mounts.append(
                Mount(  # data directory
                    target=sbinds["/data"],
                    source=os.path.join(host_userdir, "data"),
                    type="bind",
                ),
            )

        if "/project-dir" in sbinds:
            mounts.append(
                Mount(
                    target=sbinds["/project-dir"],
                    source=project_dir,
                    type="bind",
                ),
            )

        # To support orchest environments as services.
        image = service["image"]
        prefix = _config.ENVIRONMENT_AS_SERVICE_PREFIX
        if image.startswith(prefix):
            image = image.replace(prefix, "")
            image = img_mappings[image]

        specs[service_name] = {
            "image": image,
            "detach": True,
            "mounts": mounts,
            "name": container_name,
            "group_add": [os.environ.get("ORCHEST_HOST_GID")],
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
            "cpu_shares": _config.USER_CONTAINERS_CPU_SHARES,
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
        session_config: See `Args` section in class :class:`Session`.
        session_type: Type of session: interactive, or noninteractive.
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
    # host_userdir = session_config["host_userdir"]

    orchest_services_specs = {}

    orchest_services_specs["session-sidecar"] = {
        "environment": [
            f"ORCHEST_PROJECT_UUID={project_uuid}",
            f"ORCHEST_PIPELINE_UUID={pipeline_uuid}",
            f"ORCHEST_SESSION_UUID={uuid}",
            f"ORCHEST_SESSION_TYPE={session_type.value}",
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
        "ORCHEST_HOST_PIPELINE_FILE,"
        "ORCHEST_HOST_GID,"
        "ORCHEST_SESSION_UUID,"
        "ORCHEST_SESSION_TYPE,"
        "ORCHEST_GPU_ENABLED_INSTANCE,"
    )
    process_env_whitelist += ",".join([key for key in env_variables.keys()])

    if session_type == SessionType.INTERACTIVE:

        base_url = "/%s" % _config.JUPYTER_SERVER_NAME.format(
            project_uuid=project_uuid[: _config.TRUNCATED_UUID_LENGTH],
            pipeline_uuid=pipeline_uuid[: _config.TRUNCATED_UUID_LENGTH],
        )

        orchest_services_specs["jupyter-EG"] = {
            "image": "orchest/jupyter-enterprise-gateway",
            "detach": True,
            # "mounts": [
            # mounts.get("docker_sock"), mounts.get("kernelspec")],
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
                "EG_BASE_URL=%s" % base_url,
                process_env_whitelist,
                f"ORCHEST_PIPELINE_UUID={pipeline_uuid}",
                f"ORCHEST_PIPELINE_PATH={_config.PIPELINE_FILE}",
                f"ORCHEST_PROJECT_UUID={project_uuid}",
                f"ORCHEST_HOST_PROJECT_DIR={project_dir}",
                (
                    "ORCHEST_HOST_PIPELINE_FILE="
                    f"{os.path.join(project_dir, pipeline_path)}"
                ),
                f'ORCHEST_HOST_GID={os.environ.get("ORCHEST_HOST_GID")}',
                f"ORCHEST_SESSION_UUID={uuid}",
                f"ORCHEST_SESSION_TYPE={session_type.value}",
                f"ORCHEST_GPU_ENABLED_INSTANCE={CONFIG_CLASS.GPU_ENABLED_INSTANCE}",
            ]
            + user_defined_env_vars,
            "user": "root",
            "network": network,
            # Labels are used to have a way of keeping track of the
            # containers attributes through
            # ``Session.from_container_IDs``
            "labels": {"session_identity_uuid": uuid, "project_uuid": project_uuid},
        }

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
                # mounts["project_dir"],
                # # Required by the Orchest SDK.
                # mounts["pipeline_file"],
                # mounts["jupyterlab"].get("lab"),
                # mounts["jupyterlab"].get("user-settings"),
                # mounts["jupyterlab"].get("data"),
            ],
            "name": base_url[1:],  # Drop leading /
            "network": network,
            "group_add": [os.environ.get("ORCHEST_HOST_GID")],
            "command": [
                "--allow-root",
                "--port=8888",
                "--no-browser",
                f"--gateway-url={'http://' + gateway_hostname}:8888{base_url}",
                f"--notebook-dir={_config.PROJECT_DIR}",
                f"--ServerApp.base_url={base_url}",
            ],
            # Labels are used to have a way of keeping track of the
            # containers attributes through
            # ``Session.from_container_IDs``
            "labels": {"session_identity_uuid": uuid, "project_uuid": project_uuid},
        }

    return orchest_services_specs
