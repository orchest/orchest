"""Wraps complex k8s api calls to keep orchest/_core more readable.


This module is especially useful for orchest-ctl due to the use of
async_req=True in the k8s python SDK that happens here.
"""

import os
from typing import Dict, List, Optional, Union

from kubernetes import client as k8s_client

from app import config
from app.config import OrchestStatus
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


def match_labels_to_label_selector(match_labels: Dict[str, str]) -> str:
    return ",".join([f"{k}={v}" for k, v in match_labels.items()])


def get_orchest_deployments_pods(
    deployments: Union[Optional[List[str]], k8s_client.V1Pod] = None,
) -> List[Optional[k8s_client.V1Pod]]:
    if deployments is None:
        deployments = config.ORCHEST_DEPLOYMENTS
    if all([isinstance(depl, str) for depl in deployments]):
        deployments = [d for d in get_orchest_deployments(deployments) if d is not None]
    elif not all([isinstance(depl, k8s_client.V1Deployment) for depl in deployments]):
        raise ValueError(
            "Deployments should either be all of type string or all of type "
            "V1Deployments."
        )

    threads = []
    for depl in deployments:
        t = k8s_core_api.list_namespaced_pod(
            config.ORCHEST_NAMESPACE,
            label_selector=match_labels_to_label_selector(
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


def scale_down_orchest_deployments(
    deployments: Optional[List[str]] = None,
) -> None:
    if deployments is None:
        deployments = config.ORCHEST_DEPLOYMENTS
    threads = []
    for name in deployments:
        t = k8s_apps_api.patch_namespaced_deployment_scale(
            name, config.ORCHEST_NAMESPACE, {"spec": {"replicas": 0}}, async_req=True
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


def _get_ongoing_status_changing_pods() -> List[k8s_client.V1Pod]:
    """Gets both the orchest-ctl and update-server pods.

    The output is sorted by creation time.
    """
    pods = k8s_core_api.list_namespaced_pod(
        config.ORCHEST_NAMESPACE, label_selector="app in (orchest-ctl, update-server)"
    ).items
    pods = [
        p
        for p in pods
        if (
            # The update server could be launched through the GUI.
            p.metadata.labels["app"] == "update-server"
            or p.metadata.labels["command"] in config.STATUS_CHANGING_OPERATIONS
        )
    ]
    pods.sort(key=lambda pod: pod.metadata.creation_timestamp)
    return pods


def get_ongoing_status_change() -> Optional[config.OrchestStatus]:
    pods = _get_ongoing_status_changing_pods()
    if not pods:
        return None
    if pods[0].metadata.labels["app"] == "update-server":
        return config.OrchestStatus.UPDATING
    else:
        cmd = pods[0].metadata.labels["command"]
        # Just used for proper mapping of concepts, e.g. if "install"
        # then Orchest is "installing". Not all operations change the
        # state of orchest.
        ORCHEST_STATUS_CHANGING_OPERATION_TO_STATUS = {
            "install": OrchestStatus.INSTALLING,
            "start": OrchestStatus.STARTING,
            "stop": OrchestStatus.STOPPING,
            "restart": OrchestStatus.RESTARTING,
            "update": OrchestStatus.UPDATING,
        }
        return ORCHEST_STATUS_CHANGING_OPERATION_TO_STATUS[cmd]
