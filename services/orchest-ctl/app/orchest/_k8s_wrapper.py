"""Wraps complex k8s api calls to keep orchest/_core more readable.


This module is especially useful for orchest-ctl due to the use of
async_req=True in the k8s python SDK that happens here.
"""

import os
import time
from typing import Container, Dict, Iterable, List, Optional, Union

import requests
import typer
import yaml
from kubernetes import client as k8s_client

from _orchest.internals import config as _config
from app import config, utils
from app.connections import k8s_apps_api, k8s_core_api, k8s_netw_api, k8s_storage_api


def get_orchest_deployments(
    deployments: Optional[List[str]] = None,
) -> List[Optional[k8s_client.V1Deployment]]:
    """Returns Deployment objects given their name.

    Args:
        deployments: Names of deployments to retrieve. If not passed or
            None, config.ORCHEST_DEPLOYMENTS will be used.

    Return:
        List of Deployment objects, returned in the same order as the
        given deployments argument.
    """
    if deployments is None:
        deployments = config.ORCHEST_DEPLOYMENTS
    threads = []
    for name in deployments:
        t = k8s_apps_api.read_namespaced_deployment(
            name, config.ORCHEST_NAMESPACE, async_req=True
        )
        threads.append(t)

    responses = []
    for t in threads:
        try:
            deployment = t.get()
            responses.append(deployment)
        except k8s_client.ApiException as e:
            if e.status == 404:
                responses.append(None)
            else:
                raise
    return responses


def _match_labels_to_label_selector(match_labels: Dict[str, str]) -> str:
    return ",".join([f"{k}={v}" for k, v in match_labels.items()])


def get_orchest_deployments_pods(
    deployments: Optional[Union[List[str], List[k8s_client.V1Deployment]]] = None,
) -> List[Optional[k8s_client.V1Pod]]:
    if deployments is None:
        deployments = config.ORCHEST_DEPLOYMENTS

    if all(isinstance(depl, str) for depl in deployments):
        deployments = [d for d in get_orchest_deployments(deployments) if d is not None]
    elif not all(isinstance(depl, k8s_client.V1Deployment) for depl in deployments):
        raise ValueError(
            "Deployments should either all be of type string or of type V1Deployment."
        )

    threads = []
    for depl in deployments:
        t = k8s_core_api.list_namespaced_pod(
            config.ORCHEST_NAMESPACE,
            label_selector=_match_labels_to_label_selector(
                depl.spec.selector.match_labels
            ),
            async_req=True,
        )
        threads.append(t)

    pods = []
    for t in threads:
        depl_pods = t.get()
        pods.extend(depl_pods.items)
    return pods


def get_orchest_daemonsets_pods(
    daemonsets: Optional[Union[List[str], List[k8s_client.V1DaemonSet]]] = None,
) -> List[Optional[k8s_client.V1Pod]]:
    if daemonsets is None:
        daemonsets = config.ORCHEST_DAEMONSETS

    if all(isinstance(daem, str) for daem in daemonsets):
        daemonsets = [d for d in get_orchest_daemonsets(daemonsets) if d is not None]
    elif not all(isinstance(daem, k8s_client.V1DaemonSet) for daem in daemonsets):
        raise ValueError(
            "Daemonsets should either all be of type string or of type V1Daemonset."
        )

    threads = []
    for daem in daemonsets:
        t = k8s_core_api.list_namespaced_pod(
            config.ORCHEST_NAMESPACE,
            label_selector=_match_labels_to_label_selector(
                daem.spec.selector.match_labels
            ),
            async_req=True,
        )
        threads.append(t)

    pods = []
    for t in threads:
        depl_pods = t.get()
        pods.extend(depl_pods.items)
    return pods


def scale_up_orchest_deployments(deployments: Optional[List[str]] = None):
    _scale_orchest_deployments(deployments, 1)


def scale_down_orchest_deployments(deployments: Optional[List[str]] = None):
    _scale_orchest_deployments(deployments, 0)


def get_orchest_daemonsets(
    daemonsets: Optional[List[str]] = None,
) -> List[Optional[k8s_client.V1DaemonSet]]:
    """Returns Daemonsets objects given their name.

    Args:
        deployments: Names of daemonsets to retrieve. If not passed or
            None, config.ORCHEST_DAEMONSETS will be used.

    Return:
        List of Daemonsets objects, returned in the same order as the
        given deployments argument.
    """
    if daemonsets is None:
        daemonsets = config.ORCHEST_DAEMONSETS
    threads = []
    for name in daemonsets:
        t = k8s_apps_api.read_namespaced_daemon_set(
            name, config.ORCHEST_NAMESPACE, async_req=True
        )
        threads.append(t)

    responses = []
    for t in threads:
        try:
            daemonset = t.get()
            responses.append(daemonset)
        except k8s_client.ApiException as e:
            if e.status == 404:
                responses.append(None)
            else:
                raise
    return responses


def _scale_orchest_deployments(
    deployments: Optional[List[str]] = None, replicas: int = 1
) -> None:
    if deployments is None:
        deployments = config.ORCHEST_DEPLOYMENTS
    threads = []
    for name in deployments:
        t = k8s_apps_api.patch_namespaced_deployment_scale(
            name,
            config.ORCHEST_NAMESPACE,
            {"spec": {"replicas": replicas}},
            async_req=True,
        )
        threads.append(t)
    for t in threads:
        t.get()


def scale_up_orchest_daemonsets(daemonsets: Optional[List[str]] = None) -> None:
    if daemonsets is None:
        daemonsets = config.ORCHEST_DAEMONSETS
    threads = []
    for name in daemonsets:
        t = k8s_apps_api.patch_namespaced_daemon_set(
            name,
            config.ORCHEST_NAMESPACE,
            body=[
                {
                    "op": "remove",
                    "path": (
                        "/spec/template/spec/nodeSelector/"
                        + config.DAEMONSET_SCALING_FLAG
                    ),
                }
            ],
            async_req=True,
        )
        threads.append(t)

    for t in threads:
        try:
            t.get()
        except k8s_client.ApiException as e:
            # The daemonset was already running, i.e. there was no
            # nodeSelector flag set.
            if e.status != 422:
                raise e


def scale_down_orchest_daemonsets(daemonsets: Optional[List[str]] = None) -> None:
    if daemonsets is None:
        daemonsets = config.ORCHEST_DAEMONSETS
    threads = []
    for name in daemonsets:
        t = k8s_apps_api.patch_namespaced_daemon_set(
            name,
            config.ORCHEST_NAMESPACE,
            body={
                "spec": {
                    "template": {
                        "spec": {
                            "nodeSelector": {config.DAEMONSET_SCALING_FLAG: "true"}
                        }
                    }
                }
            },
            async_req=True,
        )
        threads.append(t)
    for t in threads:
        t.get()


def _get_deployment_container_env_var_patch(container_name: str, env_vars=dict) -> dict:
    patch = {
        "spec": {
            "template": {
                "spec": {
                    "containers": [
                        {
                            "name": container_name,
                            "env": [
                                {"name": k, "value": str(v)}
                                for k, v in env_vars.items()
                            ],
                        }
                    ]
                }
            }
        }
    }
    return patch


def set_orchest_cluster_version(version: str):
    k8s_core_api.patch_namespace(
        "orchest", {"metadata": {"labels": {"version": version}}}
    )


def set_orchest_cluster_log_level(
    logLevel: utils.LogLevel, patch_deployments: bool = False
):
    k8s_core_api.patch_namespace(
        "orchest", {"metadata": {"labels": {"ORCHEST_LOG_LEVEL": logLevel.value}}}
    )
    if patch_deployments:
        for depl in config.DEPLOYMENTS_WITH_ORCHEST_LOG_LEVEL_ENV_VAR:
            k8s_apps_api.patch_namespaced_deployment(
                depl,
                "orchest",
                _get_deployment_container_env_var_patch(
                    depl, {"ORCHEST_LOG_LEVEL": logLevel.value}
                ),
            )


def set_orchest_cluster_cloud_mode(cloud: bool, patch_deployments: bool = False):
    k8s_core_api.patch_namespace(
        "orchest", {"metadata": {"labels": {"CLOUD": str(cloud)}}}
    )
    if patch_deployments:
        for depl in config.DEPLOYMENTS_WITH_CLOUD_ENV_VAR:
            k8s_apps_api.patch_namespaced_deployment(
                depl,
                "orchest",
                _get_deployment_container_env_var_patch(depl, {"CLOUD": str(cloud)}),
            )


def get_orchest_cluster_version() -> str:
    return k8s_core_api.read_namespace("orchest").metadata.labels.get("version")


def get_orchest_log_level() -> str:
    return k8s_core_api.read_namespace("orchest").metadata.labels.get(
        "ORCHEST_LOG_LEVEL"
    )


def get_orchest_cloud_mode() -> str:
    return k8s_core_api.read_namespace("orchest").metadata.labels.get("CLOUD")


def delete_orchest_ctl_pods():
    """Deletes this pod and pods created by this pod.

    Used to avoid leaving dangling pods around.
    """
    # The pod will try to terminate itself, this is for safety in case
    # it does not work.
    children_pods = k8s_core_api.list_namespaced_pod(
        config.ORCHEST_NAMESPACE, label_selector=f'parent={os.environ["POD_NAME"]}'
    )
    for pod in children_pods.items:
        try:
            k8s_core_api.delete_namespaced_pod(
                pod.metadata.name, config.ORCHEST_NAMESPACE
            )
        except k8s_client.ApiException as e:
            if e.status != 404:
                raise
    k8s_core_api.delete_namespaced_pod(os.environ["POD_NAME"], "orchest")


def _get_ongoing_status_changing_pod() -> Optional[k8s_client.V1Pod]:
    """Returns a pod that is changing the state of Orchest.

    This can be used to know what operation Orchest is undergoing, or
    if another, possibly confliting command can be run concurrently or
    not. This works by checking what's the oldest pod that is running a
    status changing command, which works as a priority when it comes to
    conflicts.

    Returns:
        None if no instance of orchest-ctl running with state changing
        commands is running. That instance pod otherwise.

    """
    pods = k8s_core_api.list_namespaced_pod(
        config.ORCHEST_NAMESPACE, label_selector="app=orchest-ctl"
    ).items
    pods = [
        p
        for p in pods
        if (p.metadata.labels["command"] in config.STATUS_CHANGING_OPERATIONS)
    ]
    pods.sort(key=lambda pod: pod.metadata.creation_timestamp)
    return pods[0] if pods else None


def abort_if_unsafe() -> None:
    """Exits if the command can't be safely run.

    This is to avoid having inconsistent state due to the concurrent
    running of other CLI commands that alter the state of the Orchest
    deployment.
    """
    pod = _get_ongoing_status_changing_pod()
    if pod.metadata.name != os.environ["POD_NAME"]:
        cmd = pod.metadata.labels["command"]
        utils.echo(
            "This command cannot be run concurrently due to another "
            f"ongoing, possibly conflicting command: {cmd}."
        )
        raise typer.Exit(1)


def get_ongoing_status_change() -> Optional[config.OrchestStatus]:
    pod = _get_ongoing_status_changing_pod()
    if pod is None:
        return None
    else:
        cmd = pod.metadata.labels["command"]
        return config.ORCHEST_OPERATION_TO_STATUS_MAPPING[cmd]


_cleanup_pod_manifest = {
    "apiVersion": "v1",
    "kind": "Pod",
    "metadata": {
        # This is to avoid, in any case, a dangling pod leading to
        # stop/start errors.
        "generateName": "orchest-api-cleanup-",
        "labels": {"app": "orchest-api-cleanup", "parent": os.environ["POD_NAME"]},
    },
    "spec": {
        "restartPolicy": "Never",
        "serviceAccount": "orchest-api",
        "serviceAccountName": "orchest-api",
        "containers": [
            {
                "name": "orchest-api-cleanup",
                "image": f"orchest/orchest-api:{config.ORCHEST_VERSION}",
                "command": ["/bin/sh", "-c"],
                # Make sure the database is compatible with the code.
                "args": ["python migration_manager.py db migrate && python cleanup.py"],
                "imagePullPolicy": "IfNotPresent",
                "env": [
                    {
                        # K8S_TODO: fix it? A real value does not need
                        # to be provided since it's just used by passing
                        # it to running pipelines.
                        "name": "ORCHEST_HOST_GID",
                        "value": "1",
                    },
                    {"name": "PYTHONUNBUFFERED", "value": "TRUE"},
                    {"name": "ORCHEST_GPU_ENABLED_INSTANCE", "value": "FALSE"},
                ],
            }
        ],
    },
}


def orchest_cleanup() -> None:
    """Performs a cleanup that must be run on start and stop.

    It's implemented by spinning up a pod that will run the required
    code. Requires the orchest-database and the celery-worker services
    to be online.
    """
    manifest = _cleanup_pod_manifest
    resp = k8s_core_api.create_namespaced_pod(config.ORCHEST_NAMESPACE, manifest)
    pod_name = resp.metadata.name

    status = wait_for_pod_status(
        pod_name,
        ["Succeeded", "Failed", "Unknown"],
        notify_progress_retries_period=50,
        notify_progress_message="Still cleaning up resources...",
    )

    if status is None or status in ["Failed", "Unknown"]:
        utils.echo(
            f"Error while performing cleanup, pod status: {status}. This operation "
            "will proceed regardless."
        )

    k8s_core_api.delete_namespaced_pod(pod_name, config.ORCHEST_NAMESPACE)


def _get_orchest_ctl_update_post_manifest(update_to_version: str) -> dict:
    with open(_config.ORCHEST_CTL_POD_YAML_PATH, "r") as f:
        manifest = yaml.safe_load(f)

    labels = manifest["metadata"]["labels"]
    labels["version"] = update_to_version
    labels["command"] = "hidden-update"
    labels["parent"] = os.environ["POD_NAME"]

    spec = manifest["spec"]
    spec["containers"][0]["image"] = f"orchest/orchest-ctl:{update_to_version}"
    return manifest


def get_update_pod_manifest() -> dict:
    current_version = get_orchest_cluster_version()
    resp = requests.get(
        _config.ORCHEST_UPDATE_INFO_URL.format(version=current_version), timeout=5
    )
    if resp.status_code != 200:
        utils.echo("Failed to retrieve latest Orchest version information.")
        raise typer.Exit(1)

    latest_version = resp.json()["latest_version"]
    if latest_version == current_version:
        utils.echo("Orchest is already at the latest version.")
        raise typer.Exit(0)

    manifest = _get_orchest_ctl_update_post_manifest(latest_version)
    return manifest


def wait_for_pod_status(
    name: str,
    expected_statuses: Union[Container[str], Iterable[str]],
    max_retries: int = 999,
    notify_progress_retries_period: int = 50,
    notify_progress_message: str = "Still ongoing",
) -> None:
    status = None
    while max_retries > 0:
        max_retries = max_retries - 1
        if max_retries % notify_progress_retries_period == 0:
            utils.echo(notify_progress_message)
        try:
            resp = k8s_core_api.read_namespaced_pod(
                name=name, namespace=config.ORCHEST_NAMESPACE
            )
        except k8s_client.ApiException as e:
            if e.status != 404:
                raise
        else:
            status = resp.status.phase
            if status in expected_statuses:
                return status
        time.sleep(1)

    return status


def get_host_names() -> List[str]:
    """Returns the host names under which Orchest is reachable locally.

    Each entry needs to be mapped to the cluster ip in the /etc/hosts
    file.
    """
    hosts = set()
    try:
        r = k8s_netw_api.read_namespaced_ingress("orchest-webserver", "orchest")
    except k8s_client.ApiException as e:
        if e.status != 404:
            raise e
    else:
        for rule in r.spec.rules:
            hosts.add(rule.host)
    return sorted(hosts)


def sync_celery_parallelism_from_config() -> None:
    k8s_apps_api.patch_namespaced_deployment(
        "celery-worker",
        "orchest",
        _get_deployment_container_env_var_patch(
            "celery-worker", utils.get_celery_parallelism_level_from_config()
        ),
    )


def get_available_storage_classes() -> List[str]:
    s_classes = k8s_storage_api.list_storage_class()
    return [storage_class.metadata.name for storage_class in s_classes.items]


def get_registry_storage_class() -> Optional[str]:
    """Returns the registry storage class.

    Returns:
        The storage class used by the registry pvc. It will return None
        if no storage class is found. This is needed to migrate existing
        deployments which did not have a registry pvc defined.
    """
    try:
        r = k8s_core_api.read_namespaced_persistent_volume_claim(
            "docker-registry", config.ORCHEST_NAMESPACE
        )
        return r.spec.storage_class_name
    except k8s_client.ApiException as e:
        if e.status != 404:
            raise e
        return None


def get_orchest_cluster_storage_class() -> str:
    """Returns the storage class of the cluster.

    The storage class of the userdir-pvc is considered to be the orchest
    cluster storage class.
    """
    r = k8s_core_api.read_namespaced_persistent_volume_claim(
        "userdir-pvc", config.ORCHEST_NAMESPACE
    )
    return r.spec.storage_class_name
