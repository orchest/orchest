"""Launch a kernel as a k8s pod.

This script is meant to be used by jupyter-enterprise-gateway (EG), so
it's not something we call directly, instead, we place it in
userdir/.orchest/kernels/<project uuid> and mount this file to the EG
pod. It will launch a pod with the required env variables and specs.
Pod deletion is handled by EG.

Calls:
    browser client -> jupyter server -> jupyter EG -> this script -> k8s

Related docs:
    https://jupyter-enterprise-gateway.readthedocs.io/en/latest/kernel-kubernetes.html#kubernetes

"""
import argparse
import os
import sys
import uuid
from typing import Tuple

import requests
from kubernetes import client as k8s_client
from kubernetes import config

from _orchest.internals import config as _config
from _orchest.internals.utils import get_step_and_kernel_volumes_and_volume_mounts


def _env_image_name_to_project_environment_uuid(image_name: str) -> Tuple[str, str]:
    """Extracts a project/env uuid from an environment image name.

    See ENVIRONMENT_IMAGE_NAME for the expected format, example:
    orchest-env-ae400269-642f-42db-9db4-3be9e46ed344-61a86adf-7709-413b
    -a449-86990e77f13f
    """
    prefix = "orchest-env-"
    if not image_name.startswith(prefix):
        raise ValueError()

    image_name = image_name[len(prefix) :]
    uuid4_length = 36
    proj_uuid = image_name[:uuid4_length]
    # Make sure it's a valid UUID.
    uuid.UUID(proj_uuid)

    image_name = image_name[uuid4_length + 1 :]
    env_uuid = image_name[:uuid4_length]
    uuid.UUID(env_uuid)
    return proj_uuid, env_uuid


def _get_user_env_vars(proj_uuid: str, pipe_uuid: str) -> dict:
    project_resp = requests.get(
        "http://" + _config.ORCHEST_API_ADDRESS + f"/api/projects/{proj_uuid}"
    )
    pipeline_resp = requests.get(
        "http://"
        + _config.ORCHEST_API_ADDRESS
        + f"/api/pipelines/{proj_uuid}/{pipe_uuid}"
    )

    if project_resp.status_code != 200 or pipeline_resp.status_code != 200:
        raise RuntimeError("Failed to retrieve user environment variables.")

    project, pipeline = project_resp.json(), pipeline_resp.json()
    return {**project["env_variables"], **pipeline["env_variables"]}


def _get_kernel_pod_manifest(
    kernel_id: str, response_addr: str, spark_context_init_mode: str
) -> dict:
    image_name = os.environ.get("KERNEL_IMAGE", None)
    if image_name is None:
        sys.exit(
            "ERROR - KERNEL_IMAGE not found in environment - kernel launch terminating!"
        )
    proj_uuid, env_uuid = _env_image_name_to_project_environment_uuid(image_name)
    pipeline_uuid = os.environ["ORCHEST_PIPELINE_UUID"]

    resp = requests.get(
        "http://"
        + _config.ORCHEST_API_ADDRESS
        + f"/api/sessions/kernels/lock-image/{proj_uuid}/{pipeline_uuid}/{env_uuid}"
    )
    if resp.status_code != 200:
        sys.exit("Failed to get environment image version to use.")
    tag = resp.json()["tag"]
    image_name = f'{os.environ["ORCHEST_REGISTRY"]}/{image_name}:{tag}'

    kernel_username = os.environ.get("KERNEL_USERNAME")
    if kernel_username is None:
        name = f"kernel-{kernel_id}"
    else:
        name = f"kernel-{kernel_username}-{kernel_id}"

    metadata = {
        "name": name,
        "labels": {
            "project_uuid": os.environ["ORCHEST_PROJECT_UUID"],
            "session_uuid": os.environ["ORCHEST_SESSION_UUID"],
            "kernel_id": kernel_id,
            "component": "kernel",
            "app": "enterprise-gateway",
        },
    }

    vols, vol_mounts = get_step_and_kernel_volumes_and_volume_mounts(
        userdir_pvc=os.environ.get("ORCHEST_USERDIR_PVC"),
        project_dir=os.environ.get("ORCHEST_PROJECT_DIR"),
        pipeline_file=os.environ.get("ORCHEST_PIPELINE_FILE"),
        container_project_dir=_config.PROJECT_DIR,
        container_pipeline_file=_config.PIPELINE_FILE,
    )

    environment = dict()
    environment["EG_RESPONSE_ADDRESS"] = response_addr
    environment["KERNEL_SPARK_CONTEXT_INIT_MODE"] = spark_context_init_mode
    # Since the environment is specific to the kernel (per env stanza of
    # kernelspec, KERNEL_ and ENV_WHITELIST) just add the env here.
    environment.update(os.environ)
    try:
        user_env_vars = _get_user_env_vars(
            os.environ["ORCHEST_PROJECT_UUID"],
            pipeline_uuid,
        )
    except RuntimeError as e:
        sys.exit(e)
    else:
        # NOTE: This update needs to happen after adding `os.environ`.
        # Otherwise old env var values (that are present in the
        # environment of the EG) will overwrite updated values.
        environment.update(user_env_vars)
    # Let the image PATH be used. Since this is relative to images,
    # we're probably safe.
    environment.pop("PATH")
    env = [{"name": k, "value": v} for k, v in environment.items()]

    # K8S_TODO: device requests/gpus.
    pod_manifest = {
        "apiVersion": "v1",
        "kind": "Pod",
        "metadata": metadata,
        "spec": {
            "securityContext": {
                "runAsUser": 0,
                "runAsGroup": int(os.environ.get("ORCHEST_HOST_GID")),
                "fsGroup": int(os.environ.get("ORCHEST_HOST_GID")),
            },
            # "Kernel pods have restart policies of Never. This is
            # because the Jupyter framework already has built-in logic
            # for auto-restarting failed kernels and any other restart
            # policy would likely interfere with the built-in
            # behaviors."
            "restartPolicy": "Never",
            "volumes": vols,
            "containers": [
                {
                    "name": name,
                    "image": image_name,
                    "env": env,
                    "ports": [{"name": "web", "containerPort": 80, "protocol": "TCP"}],
                    "volumeMounts": vol_mounts,
                }
            ],
            "resources": {"requests": {"cpu": _config.USER_CONTAINERS_CPU_SHARES}},
        },
    }
    if os.environ.get("KERNEL_WORKING_DIR") is not None:
        pod_manifest["spec"]["containers"][0]["workingDir"] = os.environ[
            "KERNEL_WORKING_DIR"
        ]

    return pod_manifest


def launch_kernel(kernel_id, response_addr, spark_context_init_mode):
    manifest = _get_kernel_pod_manifest(
        kernel_id, response_addr, spark_context_init_mode
    )

    config.load_incluster_config()
    k8s_core_api = k8s_client.CoreV1Api()
    ns = _config.ORCHEST_NAMESPACE
    k8s_core_api.create_namespaced_pod(ns, manifest)


if __name__ == "__main__":
    """
    Usage: launch_kernel
        [--RemoteProcessProxy.kernel-id <kernel_id>]
        [--RemoteProcessProxy.response-address <response_addr>]
        [--RemoteProcessProxy.spark-context-initialization-mode <mode>]
    """

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--RemoteProcessProxy.kernel-id",
        dest="kernel_id",
        nargs="?",
        help="Indicates the id associated with the launched kernel.",
    )
    parser.add_argument(
        "--RemoteProcessProxy.response-address",
        dest="response_address",
        nargs="?",
        metavar="<ip>:<port>",
        help="Connection address (<ip>:<port>) for returning connection file",
    )
    parser.add_argument(
        "--RemoteProcessProxy.spark-context-initialization-mode",
        dest="spark_context_init_mode",
        nargs="?",
        help="Indicates whether or how a spark context should be created",
        default="none",
    )

    arguments = vars(parser.parse_args())
    kernel_id = arguments["kernel_id"]
    response_addr = arguments["response_address"]
    spark_context_init_mode = arguments["spark_context_init_mode"]

    launch_kernel(kernel_id, response_addr, spark_context_init_mode)
