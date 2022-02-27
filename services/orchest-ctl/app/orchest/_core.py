import atexit
import logging
import os
import signal
import subprocess
import time
from typing import Any, Dict, Optional

import typer
from kubernetes import client as k8s_client

from app import config, utils
from app.connections import k8s_core_api
from app.orchest import _k8s_wrapper as k8sw

logger = logging.getLogger(__name__)


# This is just another failsafe to make sure we don't leave dangling
# pods around.
signal.signal(signal.SIGTERM, lambda *args, **kwargs: k8sw.delete_orchest_ctl_pod())
atexit.register(k8sw.delete_orchest_ctl_pod)


def is_orchest_already_installed() -> bool:
    try:
        k8s_core_api.read_namespace(config.ORCHEST_NAMESPACE)
    except k8s_client.ApiException as e:
        if e.status == 404:
            return False
    deployments = k8sw.get_orchest_deployments()
    if all(deployments):
        return True
    elif any(deployments):
        utils.echo(
            "Unexpected Orchest installation state. Expected to find no deployments at "
            "all or a complete installation. Please verify your installation.",
            err=True,
        )
        raise typer.Exit(code=1)
    else:
        return False


def install():
    k8sw.abort_if_unsafe()
    if is_orchest_already_installed():
        utils.echo("Installation is already complete. Did you mean to run:")
        utils.echo("\torchest update")
        return

    orchest_version = os.environ.get("ORCHEST_VERSION")
    if orchest_version is None:
        utils.echo(
            "Expected to find an ORCHEST_VERSION environment variable, exiting.",
            err=True,
        )
        raise typer.Exit(code=1)

    utils.echo(f"Installing Orchest {orchest_version}.")

    # K8S_TODO: remove DISABLE_ROOK?
    env = os.environ.copy()
    env["DISABLE_ROOK"] = "TRUE"
    process = subprocess.Popen(
        ["make", "orchest"],
        cwd="deploy",
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env=env,
    )

    n_ready_deployments = 0
    returncode = None
    with typer.progressbar(
        length=len(config.ORCHEST_DEPLOYMENTS) + 1,
        label="Installation",
        show_eta=False,
    ) as progress:
        # This is just to make the bar not stay at 0% for too long
        # because images are being pulled etc, i.e. just UX.
        progress.update(1)
        while returncode is None:
            # This way we are able to perform the last update on the
            # bar in case of success before the loop exiting.
            process.poll()
            returncode = process.returncode

            # Set the progress bar to the length of the deployments that
            # are ready.
            deployments = k8sw.get_orchest_deployments()
            ready_deployments = [
                d
                for d in deployments
                if d is not None and d.status.ready_replicas == d.spec.replicas
            ]
            progress.update(len(ready_deployments) - n_ready_deployments)
            n_ready_deployments = len(ready_deployments)

            # K8S_TODO: failure cases? Or are they covered by helm?
            time.sleep(1)

    if returncode != 0:
        utils.echo(
            "There was an error during the installation of Orchest, "
            f"exit code: {returncode} .",
            err=True,
        )
        raise typer.Exit(returncode)

    logger.info("Setting 'userdir/' permissions.")
    utils.fix_userdir_permissions()

    k8sw.set_orchest_cluster_version(orchest_version)

    # K8S_TODO: coordinate with ingress for this.
    # port = 8001
    # utils.echo(f"Orchest is running at: http://localhost:{port}")
    utils.echo("Installation was successful.")
    utils.echo("Orchest is running, portforward to the webserver to access it.")


def _echo_version(
    cluster_version: str,
    deployment_versions: Optional[Dict[str, str]] = None,
    output_json: bool = False,
) -> None:
    if not output_json:
        utils.echo(f"Cluster version: {cluster_version}.")
        if deployment_versions is not None:
            differences = False
            utils.echo("Deployments:")
            max_length = max([len(k) for k in deployment_versions.keys()])
            buffer_space = max_length + 10

            for depl in sorted(deployment_versions.keys()):
                d_version = deployment_versions[depl]
                utils.echo(f"{depl:<{buffer_space}}: {d_version}")
                if depl in config.DEPLOYMENT_VERSION_SYNCED_WITH_CLUSTER_VERSION:
                    differences = differences or d_version != cluster_version
            if differences:
                utils.echo(
                    "Some deployment version differs from the cluster version. This is "
                    "an unexpected state. Upgrading or using the helm charts in "
                    "the 'deploy' directory might fix the issue.",
                    err=True,
                )
    else:
        data: Dict[str, Any] = {
            "cluster_version": cluster_version,
        }
        if deployment_versions is not None:
            data["deployment_versions"] = deployment_versions
        utils.echo_json(data)


def version(ext: bool = False, output_json: bool = False) -> None:
    """Returns the version of Orchest.

    Args:
        ext: If True return the extensive version of Orchest, i.e.
            including deployment versions.
        output_json: If True echo json instead of text.
    """
    config.JSON_MODE = output_json
    cluster_version = k8sw.get_orchest_cluster_version()
    if not ext:
        _echo_version(cluster_version, output_json=output_json)
        return

    deployments = k8sw.get_orchest_deployments(config.ORCHEST_DEPLOYMENTS)
    depl_versions = {}
    for (
        name,
        depl,
    ) in zip(config.ORCHEST_DEPLOYMENTS, deployments):
        if depl is None:
            depl_versions[name] = None
        else:
            depl_versions[name] = depl.spec.template.spec.containers[0].image.split(
                ":"
            )[1]

    _echo_version(cluster_version, depl_versions, output_json)


def status(output_json: bool = False):
    """Gets the status of Orchest.

    Note:
        This is not race condition free, given that a status changing
        command could start after our read. K8S_TODO: we could try
        multiple times if the cluster looks unhealthy, discuss.
    """
    config.JSON_MODE = output_json
    utils.echo("Checking for ongoing status changes...")
    ongoing_change = k8sw.get_ongoing_status_change()
    if ongoing_change is not None:
        status = ongoing_change
    else:
        utils.echo("No ongoing status changes, checking if Orchest is running.")

        deployments = k8sw.get_orchest_deployments(config.ORCHEST_DEPLOYMENTS)
        running_deployments = set()
        stopped_deployments = set()
        unhealthy_deployments = set()
        for depl_name, depl in zip(config.ORCHEST_DEPLOYMENTS, deployments):
            if depl is None:
                unhealthy_deployments.add(depl_name)
            else:
                replicas = depl.spec.replicas
                if replicas > 0:
                    running_deployments.add(depl_name)
                else:
                    stopped_deployments.add(depl_name)
                if replicas != depl.status.available_replicas:
                    unhealthy_deployments.add(depl_name)
        # Given that there are no ongoing status changes, Orchest can't
        # have both stopped and running deployments.  Assume that, if at
        # least 1 deployment is running, the ones which are not are
        # unhealthy.
        if stopped_deployments and running_deployments:
            unhealthy_deployments.update(stopped_deployments)
        if unhealthy_deployments:
            status = config.OrchestStatus.UNHEALTHY
            unhealthy_deployments = sorted(unhealthy_deployments)
            utils.echo(f"Unhealthy deployments: {unhealthy_deployments}.")
        elif running_deployments:
            status = config.OrchestStatus.RUNNING
        else:
            status = config.OrchestStatus.STOPPED

    utils.echo(f"Orchest is {status}.")

    if output_json:
        data = {"status": status}
        if status == "unhealthy":
            data["reason"] = {"deployments": unhealthy_deployments}
        utils.echo_json(data)


def stop():
    k8sw.abort_if_unsafe()
    depls = k8sw.get_orchest_deployments(config.ORCHEST_DEPLOYMENTS)
    missing_deployments = []
    running_deployments = []
    for depl_name, depl in zip(config.ORCHEST_DEPLOYMENTS, depls):
        if depl is None:
            missing_deployments.append(depl_name)
        elif depl.spec.replicas > 0:
            running_deployments.append(depl)

    if missing_deployments:
        if len(missing_deployments) == len(config.ORCHEST_DEPLOYMENTS):
            utils.echo("It doesn't look like Orchest is installed.")
            return
        else:
            utils.echo(
                "Detected some inconsistent state, missign deployments: "
                f"{sorted(missing_deployments)}. This operation will "
                "proceed regardless."
            )
    if not running_deployments:
        utils.echo("Orchest is not running.")
        return

    deployments_pods = k8sw.get_orchest_deployments_pods(running_deployments)
    utils.echo("Shutting down...")
    with typer.progressbar(
        # + 1 for UX and to account for the previous actions.
        length=len(deployments_pods) + 1,
        label="Shutdown",
        show_eta=False,
    ) as progress:
        k8sw.scale_down_orchest_deployments(
            [depl.metadata.name for depl in running_deployments]
        )
        progress.update(1)

        # Wait for all pods to be removed.
        while deployments_pods:
            time.sleep(1)
            tmp_pods = k8sw.get_orchest_deployments_pods(running_deployments)
            progress.update(len(deployments_pods) - len(tmp_pods))
            deployments_pods = tmp_pods

    utils.echo("Shutdown successful.")


def start():
    k8sw.abort_if_unsafe()
    depls = k8sw.get_orchest_deployments(config.ORCHEST_DEPLOYMENTS)
    missing_deployments = []
    deployments_to_start = []
    for depl_name, depl in zip(config.ORCHEST_DEPLOYMENTS, depls):
        if depl is None:
            missing_deployments.append(depl_name)
        elif depl.spec.replicas == 0:
            deployments_to_start.append(depl)

    if missing_deployments:
        if len(missing_deployments) == len(config.ORCHEST_DEPLOYMENTS):
            utils.echo("It doesn't look like Orchest is installed.")
            return
        else:
            utils.echo(
                "Detected some inconsistent state, missign deployments: "
                f"{sorted(missing_deployments)}. This operation will "
                "proceed regardless."
            )
    # Note: this implies that the operation can't be used to set the
    # scale of all deployments to 1 if, for example, it has been altered
    # to more than that.
    if not deployments_to_start:
        utils.echo("Orchest is already running.")
        return

    utils.echo("Starting...")
    deployments_to_start_names = [depl.metadata.name for depl in deployments_to_start]
    k8sw.scale_up_orchest_deployments(deployments_to_start_names)

    with typer.progressbar(
        # + 1 for UX and to account for the previous actions.
        length=len(deployments_to_start) + 1,
        label="Start",
        show_eta=False,
    ) as progress:
        # Do this after scaling but before waiting for all deployments
        # to be ready so that those can happen concurrently.
        logger.info("Setting 'userdir/' permissions.")
        utils.fix_userdir_permissions()

        # This is just to make the bar not stay at 0% for too long
        # because images are being pulled etc, i.e. just UX.
        progress.update(1)

        while deployments_to_start:
            time.sleep(1)
            tmp_deployments_to_start = [
                d
                for d in k8sw.get_orchest_deployments(deployments_to_start_names)
                if d is not None and d.status.ready_replicas != d.spec.replicas
            ]
            progress.update(len(deployments_to_start) - len(tmp_deployments_to_start))
            deployments_to_start = tmp_deployments_to_start

    # K8S_TODO: coordinate with ingress for this.
    # port = 8001
    # utils.echo(f"Orchest is running at: http://localhost:{port}")
    utils.echo("Orchest is running, portforward to the webserver to access it.")


def restart():
    stop()
    start()
