import datetime
import time
from contextlib import contextmanager
from enum import Enum
from typing import Any, Callable, Dict, Optional

from _orchest.internals.utils import get_k8s_namespace_name
from app import errors, utils
from app.connections import k8s_apps_api, k8s_core_api
from app.core.sessions import _manifests


class SessionType(Enum):
    INTERACTIVE = "interactive"
    NONINTERACTIVE = "noninteractive"


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
                it's unused for interactive session type.  User
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

    def launch(self, should_abort: Optional[Callable] = None):
        """Starts all resources needed by the session.

        Args:
            should_abort: A callable that can be used to abort the
                launch logic. When the callable returns True the launch
                is interrupted. Note that no resource cleanup takes
                place, and the caller of launch should make sure to call
                the cleanup_resources method if desired.
        """
        if should_abort is None:
            should_abort = bool  # Returns False.
        logger = utils.get_logger()
        project_uuid = self._session_config["project_uuid"]
        logger.info("Creating namespace.")
        utils.create_namespace(project_uuid, self.pipeline_or_run_uuid)

        # Internal Orchest session services.
        orchest_service_deployment_manifests = [
            _manifests._get_memory_server_deployment_manifest(
                self.pipeline_or_run_uuid,
                self._session_config,
                self._session_type.value,
            ),
            _manifests._get_session_sidecar_deployment_manifest(
                self.pipeline_or_run_uuid,
                self._session_config,
                self._session_type.value,
            ),
        ]

        user_service_deployment_manifests = []
        user_service_services_manifests = []
        for service_config in self._session_config.get("services", {}).values():
            if self._session_type.value not in service_config["scope"]:
                continue
            dep, serv = _manifests._get_user_service_deployment_service_manifest(
                self.pipeline_or_run_uuid,
                self._session_config,
                service_config,
                self._session_type.value,
            )
            user_service_deployment_manifests.append(dep)
            user_service_services_manifests.append(serv)

        if should_abort():
            return

        logger.info("Creating Orchest session services deployments.")
        ns = get_k8s_namespace_name(project_uuid, self.pipeline_or_run_uuid)
        for manifest in orchest_service_deployment_manifests:
            logger.info(f'Creating deployment {manifest["metadata"]["name"]}')
            k8s_apps_api.create_namespaced_deployment(
                ns,
                manifest,
            )

        if should_abort():
            return

        logger.info("Waiting for Orchest session service deployments to be ready.")
        for manifest in orchest_service_deployment_manifests:
            name = manifest["metadata"]["name"]
            deployment = k8s_apps_api.read_namespaced_deployment_status(name, ns)
            while deployment.status.updated_replicas != deployment.spec.replicas:
                if should_abort():
                    return
                logger.info(f"Waiting for {name}.")
                time.sleep(1)
                deployment = k8s_apps_api.read_namespaced_deployment_status(name, ns)

        if should_abort():
            return

        logger.info("Creating user session services deployments.")
        ns = get_k8s_namespace_name(project_uuid, self.pipeline_or_run_uuid)
        for manifest in user_service_deployment_manifests:
            logger.info(f'Creating deployment {manifest["metadata"]["name"]}')
            k8s_apps_api.create_namespaced_deployment(
                ns,
                manifest,
            )

        if should_abort():
            return

        logger.info("Creating user session services k8s services.")
        for manifest in user_service_services_manifests:
            logger.info(f'Creating service {manifest["metadata"]["name"]}')
            k8s_core_api.create_namespaced_service(
                ns,
                manifest,
            )

        logger.info("Waiting for user session service deployments to be ready.")
        for manifest in user_service_deployment_manifests:
            name = manifest["metadata"]["name"]
            deployment = k8s_apps_api.read_namespaced_deployment_status(name, ns)
            while deployment.status.updated_replicas != deployment.spec.replicas:
                if should_abort():
                    return
                logger.info(f"Waiting for {name}.")
                time.sleep(1)
                deployment = k8s_apps_api.read_namespaced_deployment_status(name, ns)

    def shutdown(self):
        """Shutdowns the session."""
        self.cleanup_resources()
        # K8S_TODO: delete dangling environment images.

    def cleanup_resources(self):
        """Deletes all related resources."""
        k8s_core_api.delete_namespace(
            get_k8s_namespace_name(
                self._session_config["project_uuid"], self.pipeline_or_run_uuid
            ),
        )

    def restart_session_service(
        self, service_name: bool, wait_for_readiness: bool = True
    ) -> None:
        """Restarts a session service by name.

        Especially for the `memory-server` this comes in handy. Because
        the user should be able to clear the server. Which internally we
        do by restarting it, since clearing would also lose all state.
        Note that restarting the `memory-server` resets its eviction
        state, which is exactly what we want.

        """
        # We make use of the fact that session services are implemented
        # as deployment by patching them to provoke a rolling restart.
        # https://github.com/kubernetes-client/python/issues/1378

        now = datetime.datetime.utcnow()
        now = str(now.isoformat("T") + "Z")

        if service_name == "memory-server":
            manifest = (
                Session._get_memory_server_deployment_manifest(
                    self.pipeline_or_run_uuid, self._session_config, self._session_type
                ),
            )
        elif service_name == "session-sidecar":
            manifest = (
                Session._get_memory_server_deployment_manifest(
                    self.pipeline_or_run_uuid, self._session_config, self._session_type
                ),
            )
        else:
            raise errors.NoSuchSessionServiceError()

        manifest["spec"]["metadata"]["annotations"] = {
            "kubectl.kubernetes.io/restartedAt": now
        }
        ns = get_k8s_namespace_name(
            self._session_config["project_uuid"], self.pipeline_or_run_uuid
        )
        k8s_apps_api.patch_namespaced_deployment(service_name, ns, manifest)

        if not wait_for_readiness:
            return

        deployment = k8s_apps_api.read_namespaced_deployment_status(service_name, ns)
        while deployment.status.updated_replicas != deployment.spec.replicas:
            time.sleep(1)
            deployment = k8s_apps_api.read_namespaced_deployment_status(
                service_name, ns
            )


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
    uuid: str, session_config: Dict[str, Any], should_abort: Optional[Callable] = None
) -> NonInteractiveSession:
    """Launches a non-interactive session for a particular pipeline.

    Args:
        See the launch args of the Session class.

    Yields:
        A Session object that has already launched its resources, set
        in NonInteractive mode.

    """
    session = NonInteractiveSession(uuid, session_config)
    try:
        session.launch(should_abort)
        yield session
    finally:
        session.shutdown()
