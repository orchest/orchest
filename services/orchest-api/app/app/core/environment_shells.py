import time
from typing import Optional

from _orchest.internals import config as _config
from app import utils
from app.connections import k8s_apps_api, k8s_core_api
from app.core.sessions import _manifests

logger = utils.get_logger()


def launch_environment_shell(
    session_uuid: str,
    service_name: str,
    shell_uuid: str,
    project_uuid: str,
    pipeline_uuid: str,
    pipeline_path: str,
    userdir_pvc: str,
    project_dir: str,
    environment_image: str,
    auth_user_uuid: Optional[str] = None,
) -> None:
    """Starts environment shell

    Args:
        session_uuid: UUID to identify the session k8s namespace with,
            which is where all related resources will be deployed.
        service_name: service name used for the k8s service for
            host based communication.
        shell_uuid: UUID to identify the shell.
        project_uuid: UUID of the project.
        pipeline_uuid: UUID of the pipeline.
        pipeline_path: Relative path (from project directory root) to
            the pipeline file e.g. 'abc/pipeline.orchest'.
        userdir_pvc: Name of the k8s PVC e.g. 'userdir-pvc'.
        project_dir: Name of the project directory e.g. 'my-project'
            note this is always a single path component.
        environment_image: The full image specification that can be
            given directly as the image string to the container runtime.
        auth_user_uuid: uuid of the auth user for which to inject the
         git configuration if exists.


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

    (
        environment_shell_deployment_manifest,
        environment_shell_service_manifest,
    ) = _manifests._get_environment_shell_deployment_service_manifest(
        session_uuid,
        service_name,
        shell_uuid,
        project_uuid,
        pipeline_uuid,
        pipeline_path,
        userdir_pvc,
        project_dir,
        environment_image,
        auth_user_uuid,
    )

    ns = _config.ORCHEST_NAMESPACE

    logger.info(
        "Creating deployment %s"
        % (environment_shell_deployment_manifest["metadata"]["name"],)
    )
    k8s_apps_api.create_namespaced_deployment(
        ns,
        environment_shell_deployment_manifest,
    )

    logger.info(
        f'Creating service {environment_shell_service_manifest["metadata"]["name"]}'
    )
    k8s_core_api.create_namespaced_service(
        ns,
        environment_shell_service_manifest,
    )

    logger.info("Waiting for environment shell service deployment to be ready.")
    deployment_name = environment_shell_deployment_manifest["metadata"]["name"]
    deployment = k8s_apps_api.read_namespaced_deployment_status(deployment_name, ns)
    while deployment.status.available_replicas != deployment.spec.replicas:
        logger.info(f"Waiting for {deployment_name}.")
        time.sleep(1)
        deployment = k8s_apps_api.read_namespaced_deployment_status(deployment_name, ns)


def get_environment_shells(session_uuid: str):
    """Gets all related resources, idempotent."""
    ns = _config.ORCHEST_NAMESPACE
    label_selector = f"session_uuid={session_uuid},app=environment-shell"

    try:
        services = k8s_core_api.list_namespaced_service(
            ns, label_selector=label_selector
        )

        return [
            {
                "hostname": service.metadata.name,
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


def stop_environment_shell(environment_shell_uuid: str):
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
