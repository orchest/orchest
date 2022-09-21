"""Launch a kernel as a k8s pod.

This script is meant to be used by jupyter-enterprise-gateway (EG), so
it's not something we call directly, instead, we place it in
userdir/.orchest/kernels/<project uuid> and mount this file to the EG
pod. It will request the creation of a kernel pod to the orchest-api.
Pod deletion is handled by EG.

Calls:
    browser client -> jupyter server -> jupyter EG -> this script ->
    orchest-api -> k8s

Related docs:
    https://jupyter-enterprise-gateway.readthedocs.io/en/latest/kernel-kubernetes.html#kubernetes

"""
import argparse
import os
import sys

import requests

from _orchest.internals import config as _config


def launch_kernel(kernel_id, response_addr, spark_context_init_mode):
    project_uuid = os.environ["ORCHEST_PROJECT_UUID"]
    pipeline_uuid = os.environ["ORCHEST_PIPELINE_UUID"]
    kernel_spec = {
        "kernel_working_dir": os.environ.get("KERNEL_WORKING_DIR"),
        "kernel_username": os.environ.get("KERNEL_USERNAME"),
        "kernel_image": os.environ["KERNEL_IMAGE"],
        "kernel_id": kernel_id,
        "eg_response_address": response_addr,
        "spark_context_init_mode": spark_context_init_mode,
        "pipeline_file": os.environ["ORCHEST_PIPELINE_FILE"],
        "pipeline_path": os.environ["ORCHEST_PIPELINE_PATH"],
        "project_dir": os.environ["ORCHEST_PROJECT_DIR"],
    }
    resp = requests.post(
        url=(
            f"http://{_config.ORCHEST_API_ADDRESS}/api/sessions/"
            f"{project_uuid}/{pipeline_uuid}/kernels"
        ),
        json=kernel_spec,
    )
    if resp.status_code != 201:
        sys.exit(f"Kernel pod request failed: {resp.status_code}, {resp.json()}.")


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
