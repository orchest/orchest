import time
from typing import Any, Dict

from _orchest.internals import config as _config
from app import utils
from app.connections import k8s_apps_api, k8s_core_api
from app.core.sessions import _manifests

logger = utils.get_logger()


def launch_environment_shell(
    session_uuid: str,
    project_uuid: str,
    userdir_pvc: str,
    project_dir: str,
    environment_image: str,
) -> Dict[str, Any]:
    """Starts environment shell

    Args:
        session_uuid: UUID to identify the session k8s namespace with,
            which is where all related resources will be deployed.

    The resources created in k8s
      deployments
      services
      ingresses
      pods
      service_accounts
      role_bindings
      roles

    Will be cleaned up when the session is stopped.
    """

    environment_shell_service_k8s_deployment_manifests = []
    environment_shell_service_manifest = []

    (depl, serv,) = _manifests._get_environment_shell_deployment_service_manifest(
        session_uuid, project_uuid, userdir_pvc, project_dir, environment_image
    )
    environment_shell_service_manifest = serv
    environment_shell_service_k8s_deployment_manifests.append(depl)

    ns = _config.ORCHEST_NAMESPACE

    logger.info("Creating environment shell services deployments.")

    for manifest in environment_shell_service_k8s_deployment_manifests:
        logger.info(f'Creating deployment {manifest["metadata"]["name"]}')
        k8s_apps_api.create_namespaced_deployment(
            ns,
            manifest,
        )

    logger.info(
        f'Creating service {environment_shell_service_manifest["metadata"]["name"]}'
    )
    k8s_core_api.create_namespaced_service(
        ns,
        environment_shell_service_manifest,
    )

    logger.info("Waiting for environment shell service deployments to be ready.")
    for manifest in environment_shell_service_k8s_deployment_manifests:
        name = manifest["metadata"]["name"]
        deployment = k8s_apps_api.read_namespaced_deployment_status(name, ns)
        while deployment.status.available_replicas != deployment.spec.replicas:
            logger.info(f"Waiting for {name}.")
            time.sleep(1)
            deployment = k8s_apps_api.read_namespaced_deployment_status(name, ns)

    environment_shell_uuid = environment_shell_service_manifest["metadata"][
        "name"
    ].replace("environment-shell-", "")

    return {
        "host": environment_shell_service_manifest["metadata"]["name"],
        "uuid": environment_shell_uuid,
        "session_uuid": session_uuid,
    }


def get_environment_shells(session_uuid):
    """Gets all related resources, idempotent."""
    ns = _config.ORCHEST_NAMESPACE
    label_selector = f"session_uuid={session_uuid},app=environment-shell"

    try:
        services = k8s_core_api.list_namespaced_service(
            ns, label_selector=label_selector
        )

        return [
            {
                "host": service.metadata.name,
                "session_uuid": session_uuid,
                "uuid": service.metadata.name.replace("environment-shell-", ""),
            }
            for service in services.items
        ]

    except Exception as e:
        logger.error(
            "Failed to get environment shells for session UUID %s" % session_uuid
        )
        logger.error("Error %s [%s]" % (e, type(e)))

        return []


def stop_environment_shell(environment_shell_uuid):
    """Deletes environment shell."""
    # Note: we rely on the fact that deleting the deployment leads to a
    # SIGTERM to the container, which will be used to delete the
    # existing jupyterlab user config lock for interactive sessions.
    # See PR #254.
    ns = _config.ORCHEST_NAMESPACE
    name = "environment-shell-" + environment_shell_uuid

    try:
        k8s_apps_api.delete_namespaced_deployment(name, ns)
        k8s_core_api.delete_namespaced_service(name, ns)
    except Exception as e:
        logger.error(
            "Failed to delete environment shell with UUID %s" % environment_shell_uuid
        )
        logger.error("Error %s [%s]" % (e, type(e)))
