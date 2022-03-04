"""Wraps complex k8s api calls to keep orchest/_core more readable.


This module is especially useful for orchest-ctl due to the use of
async_req=True in the k8s python SDK that happens here.
"""

import os
import time
from typing import Dict, List, Optional, Union

import typer
from kubernetes import client as k8s_client

from app import config, utils
from app.connections import k8s_apps_api, k8s_core_api


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
            "Deployments should either all be of type string or of type V1Deployments."
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


def scale_up_orchest_deployments(deployments: Optional[List[str]] = None):
    _scale_orchest_deployments(deployments, 1)


def scale_down_orchest_deployments(deployments: Optional[List[str]] = None):
    _scale_orchest_deployments(deployments, 0)


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


def set_orchest_cluster_version(version: str):
    k8s_core_api.patch_namespace(
        "orchest", {"metadata": {"labels": {"version": version}}}
    )


def get_orchest_cluster_version() -> str:
    return k8s_core_api.read_namespace("orchest").metadata.labels.get("version")


def delete_orchest_ctl_pod():
    """Deletes the pod in which this script is running

    Used to avoid leaving dangling pods around.
    """
    k8s_core_api.delete_namespaced_pod(os.environ["POD_NAME"], "orchest")


def _get_ongoing_status_changing_pod() -> Optional[k8s_client.V1Pod]:
    """Returns a pod that is changing the state of Orchest.

    This can be used to know what operation Orchest is undergoing, or
    if another, possibly confliting command can be run concurrently or
    not. This works by checking what's the oldest pod that is running a
    status changing command or the update-server, which works as a
    priority when it comes to conflicts.

    Returns:
        None if no instance of the update-server or orchest-ctl running
        with state changing commands is not running. That instance pod
        otherwise.

    """
    pods = k8s_core_api.list_namespaced_pod(
        config.ORCHEST_NAMESPACE, label_selector="app in (orchest-ctl, update-server)"
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
    if pod.metadata.labels["app"] == "update-server":
        return config.OrchestStatus.UPDATING
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
        "labels": {"app": "orchest-api-cleanup"},
    },
    "spec": {
        "restartPolicy": "Never",
        "serviceAccount": "orchest-api",
        "serviceAccountName": "orchest-api",
        "containers": [
            {
                "name": "orchest-api-cleanup",
                "image": f'orchest/orchest-api:{os.environ["ORCHEST_VERSION"]}',
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
                "volumeMounts": [{"name": "dockersock", "mountPath": "/var/run"}],
            }
        ],
        "volumes": [
            {
                "name": "dockersock",
                "hostPath": {"path": "/var/run", "type": "Directory"},
            }
        ],
    },
}


def orchest_cleanup() -> None:
    """Performs a cleanup that must be run on start and stop.

    It's implemented by spinning up a pod that will run the required
    code. Requires the orchest-dabatase and the celery-worker services
    to be online.
    """
    manifest = _cleanup_pod_manifest
    # K8S_TODO: fix this once we move to versioned images.
    manifest["spec"]["containers"][0]["image"] = "orchest/orchest-api:latest"
    resp = k8s_core_api.create_namespaced_pod(config.ORCHEST_NAMESPACE, manifest)
    pod_name = resp.metadata.name

    max_retries = 1000
    status = None
    while max_retries > 0:
        max_retries = max_retries - 1
        try:
            resp = k8s_core_api.read_namespaced_pod(
                name=pod_name, namespace=config.ORCHEST_NAMESPACE
            )
        except k8s_client.ApiException as e:
            if e.status != 404:
                raise
            time.sleep(1)
        else:
            status = resp.status.phase
            if status in ["Succeeded", "Failed", "Unknown"]:
                break
        time.sleep(1)

    if status is None or status in ["Failed", "Unknown"]:
        utils.echo(
            f"Error while performing cleanup, pod status: {status}. This operation "
            "will proceed regardless."
        )

    k8s_core_api.delete_namespaced_pod(pod_name, config.ORCHEST_NAMESPACE)
