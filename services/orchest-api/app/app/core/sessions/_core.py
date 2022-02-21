import time
from contextlib import contextmanager
from typing import Callable, List, Optional

import requests
from kubernetes import client

from _orchest.internals import config as _config
from app import errors, utils
from app.connections import k8s_apps_api, k8s_core_api, k8s_rbac_api
from app.core.sessions import _manifests
from app.types import NonInteractiveSessionConfig, SessionConfig, SessionType

logger = utils.get_logger()


def launch(
    session_uuid: str,
    session_type: SessionType,
    session_config: SessionConfig,
    should_abort: Optional[Callable] = None,
) -> None:
    """Starts all resources needed by the session.

    Args:
        session_uuid: UUID to identify the session k8s namespace with,
            which is where all related resources will be deployed.
        session_type: Implies which orchest session services are part
            of the session. For "noninteractive" sessions these are
            the memory-server and session-sidecar, "interactive"
            sessions also include jupyter-eg and jupyter-server. These
            services, along with any user defined service, can be
            interacted with using the functions in this module through
            their name.
        session_config: See the `SessionConfig` TypedDict in the types
            module.
        should_abort: A callable that can be used to abort the
            launch logic. When the callable returns True the launch
            is interrupted. Note that no resource cleanup takes
            place, and the caller of launch should make sure to call
            the cleanup_resources method if desired.
    """
    if should_abort is None:

        def always_false(*args, **kwargs):
            return False

        should_abort = always_false

    # Internal Orchest session services.
    orchest_session_service_k8s_deployment_manifests = []
    orchest_session_service_k8s_service_manifests = []
    session_rbac_roles = []
    session_rbac_service_accounts = []
    session_rbac_rolebindings = []
    if session_type in [SessionType.INTERACTIVE, SessionType.NONINTERACTIVE]:
        if session_config.get("services", {}):
            logger.info("Adding session sidecar to log user services.")
            (
                role,
                service_account,
                rolebinding,
            ) = _manifests._get_session_sidecar_rbac_manifests(
                session_uuid, session_config
            )
            session_rbac_roles.append(role)
            session_rbac_service_accounts.append(service_account)
            session_rbac_rolebindings.append(rolebinding)
            orchest_session_service_k8s_deployment_manifests.append(
                _manifests._get_session_sidecar_deployment_manifest(
                    session_uuid, session_config, session_type
                )
            )
    else:
        raise ValueError(f"Invalid session type: {session_type}.")

    if session_type == SessionType.INTERACTIVE:
        (
            role,
            service_account,
            rolebinding,
        ) = _manifests._get_jupyter_enterprise_gateway_rbac_manifests(
            session_uuid, session_config
        )
        session_rbac_roles.append(role)
        session_rbac_service_accounts.append(service_account)
        session_rbac_rolebindings.append(rolebinding)

        (
            depl,
            serv,
        ) = _manifests._get_jupyter_enterprise_gateway_deployment_service_manifest(
            session_uuid, session_config, session_type
        )
        orchest_session_service_k8s_deployment_manifests.append(depl)
        orchest_session_service_k8s_service_manifests.append(serv)
        depl, serv = _manifests._get_jupyter_server_deployment_service_manifest(
            session_uuid, session_config, session_type
        )
        orchest_session_service_k8s_deployment_manifests.append(depl)
        orchest_session_service_k8s_service_manifests.append(serv)

    user_session_service_k8s_deployment_manifests = []
    user_session_service_k8s_service_manifests = []
    for service_config in session_config.get("services", {}).values():
        if session_type.value not in service_config["scope"]:
            continue
        dep, serv = _manifests._get_user_service_deployment_service_manifest(
            session_uuid,
            session_config,
            service_config,
            session_type,
        )
        user_session_service_k8s_deployment_manifests.append(dep)
        user_session_service_k8s_service_manifests.append(serv)

    ns = _config.ORCHEST_NAMESPACE

    logger.info("Creating session RBAC roles.")
    for manifest in session_rbac_roles:
        logger.info(f'Creating role {manifest["metadata"]["name"]}')
        k8s_rbac_api.create_namespaced_role(ns, manifest)

    logger.info("Creating session RBAC service accounts.")
    for manifest in session_rbac_service_accounts:
        logger.info(f'Creating service account {manifest["metadata"]["name"]}')
        k8s_core_api.create_namespaced_service_account(ns, manifest)

    logger.info("Creating session RBAC role bindings.")
    for manifest in session_rbac_rolebindings:
        logger.info(f'Creating role binding {manifest["metadata"]["name"]}')
        k8s_rbac_api.create_namespaced_role_binding(ns, manifest)

    logger.info("Creating Orchest session services deployments.")
    for manifest in orchest_session_service_k8s_deployment_manifests:
        logger.info(f'Creating deployment {manifest["metadata"]["name"]}')
        k8s_apps_api.create_namespaced_deployment(
            ns,
            manifest,
        )

    logger.info("Creating Orchest session services k8s services.")
    for manifest in orchest_session_service_k8s_service_manifests:
        logger.info(f'Creating service {manifest["metadata"]["name"]}')
        k8s_core_api.create_namespaced_service(
            ns,
            manifest,
        )

    logger.info("Creating user session services deployments.")
    for manifest in user_session_service_k8s_deployment_manifests:
        logger.info(f'Creating deployment {manifest["metadata"]["name"]}')
        k8s_apps_api.create_namespaced_deployment(
            ns,
            manifest,
        )

    logger.info("Creating user session services k8s services.")
    for manifest in user_session_service_k8s_service_manifests:
        logger.info(f'Creating service {manifest["metadata"]["name"]}')
        k8s_core_api.create_namespaced_service(
            ns,
            manifest,
        )

    logger.info("Waiting for user and orchest session service deployments to be ready.")
    for manifest in (
        user_session_service_k8s_deployment_manifests
        + orchest_session_service_k8s_deployment_manifests
    ):
        name = manifest["metadata"]["name"]
        deployment = k8s_apps_api.read_namespaced_deployment_status(name, ns)
        while deployment.status.available_replicas != deployment.spec.replicas:
            if should_abort():
                return
            logger.info(f"Waiting for {name}.")
            time.sleep(1)
            deployment = k8s_apps_api.read_namespaced_deployment_status(name, ns)


def shutdown(session_uuid: str, wait_for_completion: bool = False):
    """Shutdowns the session."""
    cleanup_resources(session_uuid, wait_for_completion)


def cleanup_resources(session_uuid: str, wait_for_completion: bool = False):
    """Deletes all related resources, idempotent."""
    # Note: we rely on the fact that deleting the deployment leads to a
    # SIGTERM to the container, which will be used to delete the
    # existing jupyterlab user config lock for interactive sessions.
    # See PR #254.
    ns = _config.ORCHEST_NAMESPACE

    # Implemented in the next commit.


def has_busy_kernels(session_uuid: str) -> bool:
    """Tells if the session has busy kernels.

    Args:
        session_config: Requires a "project_uuid" and a
        "pipeline_uuid".

    """
    # https://jupyter-server.readthedocs.io/en/latest/developers/rest-api.html
    ns = _config.ORCHEST_NAMESPACE
    service_dns_name = f"jupyter-server.{ns}.svc.cluster.local"
    # Coupled with the juputer-server service port.
    url = f"http://{service_dns_name}/jupyter-server/api/kernels"
    response = requests.get(url, timeout=2.0)

    # Expected format: a list of dictionaries.
    # [{'id': '3af6f3b9-4358-43b9-b2dd-03b51c4f7881', 'name':
    # 'orchest-kernel-c56ab762-539c-4cce-9b1e-c4b00300ec6f',
    # 'last_activity': '2021-11-10T09:04:10.508031Z',
    # 'execution_state': 'idle', 'connections': 2}]
    kernels: List[dict] = response.json()
    return any(kernel.get("execution_state") == "busy" for kernel in kernels)


def restart_session_service(
    session_uuid: str, service_name: str, wait_for_readiness: bool = True
) -> None:
    """Restarts a session service by name.

    Especially for the `memory-server` this comes in handy. Because
    the user should be able to clear the server. Which internally we
    do by restarting it, since clearing would also lose all state.
    Note that restarting the `memory-server` resets its eviction
    state, which is exactly what we want.

    """
    ns = _config.ORCHEST_NAMESPACE
    k8s_core_api.delete_collection_namespaced_pod(
        namespace=ns, label_selector=f"app={service_name}"
    )

    if wait_for_readiness:
        deployment = k8s_apps_api.read_namespaced_deployment_status(service_name, ns)
        while deployment.status.available_replicas != deployment.spec.replicas:
            time.sleep(1)
            deployment = k8s_apps_api.read_namespaced_deployment_status(
                service_name, ns
            )


@contextmanager
def launch_noninteractive_session(
    session_uuid: str,
    session_config: NonInteractiveSessionConfig,
    should_abort: Optional[Callable] = None,
) -> None:
    """Launches a non-interactive session for a particular pipeline.

    Exiting the context leads to a shutdown of the session.

    Args:
        See args of "launch".

    Yields:
        None

    """
    try:
        launch(session_uuid, SessionType.NONINTERACTIVE, session_config, should_abort)
        yield None
    finally:
        shutdown(session_uuid)
