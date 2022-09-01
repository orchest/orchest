import time

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
) -> str:
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

    # Return service name to use as host
    return environment_shell_service_manifest["metadata"]["name"]
