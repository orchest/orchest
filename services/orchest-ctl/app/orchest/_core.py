import atexit
import logging
import os
import signal
import subprocess
import time
from enum import Enum
from typing import Any, Dict, List, Optional

import typer
from kubernetes import client as k8s_client
from kubernetes import stream

from app import config, utils
from app.connections import k8s_core_api
from app.orchest import _k8s_wrapper as k8sw

logger = logging.getLogger(__name__)


# This is just another failsafe to make sure we don't leave dangling
# pods around.
signal.signal(signal.SIGTERM, lambda *args, **kwargs: k8sw.delete_orchest_ctl_pods())
atexit.register(k8sw.delete_orchest_ctl_pods)


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


class HelmMode(str, Enum):
    INSTALL = "Install"
    UPGRADE = "Update"


def _run_helm_with_progress_bar(mode: HelmMode) -> None:
    if mode == HelmMode.INSTALL:
        cmd = "make orchest"
    elif mode == HelmMode.UPGRADE:
        cmd = "make registry-upgrade && make argo-upgrade && make orchest-upgrade"
    else:
        raise ValueError()

    log_level = k8sw.get_orchest_log_level()
    cloud = k8sw.get_orchest_cloud_mode() == "True"

    # K8S_TODO: remove DISABLE_ROOK?
    env = os.environ.copy()
    env["DISABLE_ROOK"] = "TRUE"
    process = subprocess.Popen(
        cmd,
        cwd="deploy",
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env=env,
        shell=True,
    )

    n_ready_deployments = 0
    return_code = None
    with typer.progressbar(
        length=len(config.ORCHEST_DEPLOYMENTS) + 1,
        label=mode.value,
        show_eta=False,
    ) as progress_bar:
        # This is just to make the bar not stay at 0% for too long
        # because images are being pulled etc, i.e. just UX.
        progress_bar.update(1)
        while return_code is None:
            # This way we are able to perform the last update on the
            # bar in case of success before the loop exiting.
            process.poll()
            return_code = process.returncode

            # Set the progress bar to the length of the deployments that
            # are ready.
            deployments = k8sw.get_orchest_deployments()
            ready_deployments = [
                d
                for d in deployments
                if d is not None and d.status.ready_replicas == d.spec.replicas
            ]
            progress_bar.update(len(ready_deployments) - n_ready_deployments)
            n_ready_deployments = len(ready_deployments)

            # K8S_TODO: failure cases? Or are they covered by helm?
            time.sleep(1)

    if return_code != 0:
        # We use stdout because we are redirecting stderr to stdout.
        utils.echo(str(process.stdout.read()), err=True)

    return return_code


def install(log_level: utils.LogLevel, cloud: bool):
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

    k8sw.set_orchest_cluster_log_level(log_level, patch_deployments=False)
    k8sw.set_orchest_cluster_cloud_mode(cloud, patch_deployments=False)
    return_code = _run_helm_with_progress_bar(HelmMode.INSTALL)

    if return_code != 0:
        utils.echo(
            "There was an error during the installation of Orchest, "
            f"exit code: {return_code} .",
            err=True,
        )
        raise typer.Exit(return_code)

    logger.info("Setting 'userdir/' permissions.")
    utils.fix_userdir_permissions()

    logger.info("Creating the required directories.")
    utils.create_required_directories()

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


def _wait_deployments_to_be_stopped(
    deployments: List[k8s_client.V1Deployment], progress_bar
) -> None:
    pods = k8sw.get_orchest_deployments_pods(deployments)
    while pods:
        tmp_pods = k8sw.get_orchest_deployments_pods(deployments)
        progress_bar.update(len(pods) - len(tmp_pods))
        pods = tmp_pods
        time.sleep(1)


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
            utils.echo("It looks like Orchest isn't installed.")
            return
        else:
            utils.echo(
                "Detected some inconsistent state, missing deployments: "
                f"{sorted(missing_deployments)}. Orchest will be stopped "
                "regardless."
            )
    if not running_deployments:
        utils.echo("Orchest is not running.")
        return

    utils.echo("Shutting down...")
    pre_cleanup_deployments_to_stop = []
    post_cleanup_deployments_to_stop = []
    for depl in running_deployments:
        # Shut down those before cleanup, this way the webserver won't
        # be available to the user and the orchest-api scheduler won't
        # run any job while the cleanup is in progress.
        if depl.metadata.name in ["orchest-api", "orchest-webserver"]:
            pre_cleanup_deployments_to_stop.append(depl)
        else:
            post_cleanup_deployments_to_stop.append(depl)

    deployments_pods = k8sw.get_orchest_deployments_pods(running_deployments)
    with typer.progressbar(
        # + 1 for UX and to account for the previous actions.
        length=len(deployments_pods) + 1,
        label="Shutdown",
        show_eta=False,
    ) as progress_bar:
        progress_bar.update(1)
        k8sw.scale_down_orchest_deployments(
            [depl.metadata.name for depl in pre_cleanup_deployments_to_stop]
        )
        _wait_deployments_to_be_stopped(pre_cleanup_deployments_to_stop, progress_bar)

        k8sw.orchest_cleanup()

        k8sw.scale_down_orchest_deployments(
            [depl.metadata.name for depl in post_cleanup_deployments_to_stop]
        )
        _wait_deployments_to_be_stopped(post_cleanup_deployments_to_stop, progress_bar)

    utils.echo("Shutdown successful.")


def _wait_deployments_to_be_ready(
    deployments: List[k8s_client.V1Deployment], progress_bar
) -> None:
    while deployments:
        depl_names = [depl.metadata.name for depl in deployments]
        tmp_deployments_to_start = [
            d
            for d in k8sw.get_orchest_deployments(depl_names)
            if d is not None and d.status.ready_replicas != d.spec.replicas
        ]
        progress_bar.update(len(deployments) - len(tmp_deployments_to_start))
        deployments = tmp_deployments_to_start
        time.sleep(1)


def start(log_level: utils.LogLevel, cloud: bool):
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
                "Detected some inconsistent state, missing deployments: "
                f"{sorted(missing_deployments)}. This operation will proceed "
                "regardless of that. Try to stop Orchest and start it again if this "
                "doesn't work."
            )
    # Note: this implies that the operation can't be used to set the
    # scale of all deployments to 1 if, for example, it has been altered
    # to more than that.
    if not deployments_to_start:
        utils.echo("Orchest is already running.")
        return

    utils.echo("Starting...")
    with typer.progressbar(
        # + 1 for scaling, +1 for userdir permissions.
        length=len(deployments_to_start) + 2,
        label="Start",
        show_eta=False,
    ) as progress_bar:
        k8sw.set_orchest_cluster_log_level(log_level, patch_deployments=True)
        k8sw.set_orchest_cluster_cloud_mode(cloud, patch_deployments=True)

        k8sw.scale_up_orchest_deployments(
            [depl.metadata.name for depl in deployments_to_start]
        )
        progress_bar.update(1)

        # Do this after scaling but before waiting for all deployments
        # to be ready so that those can happen concurrently.
        logger.info("Setting 'userdir/' permissions.")
        utils.fix_userdir_permissions()
        progress_bar.update(1)

        _wait_deployments_to_be_ready(deployments_to_start, progress_bar)

    # K8S_TODO: coordinate with ingress for this.
    # port = 8001
    # utils.echo(f"Orchest is running at: http://localhost:{port}")
    utils.echo("Orchest is running, portforward to the webserver to access it.")


def restart():
    log_level = k8sw.get_orchest_log_level()
    level_to_str = {level.value: level for level in utils.LogLevel}
    log_level = level_to_str.get(log_level, utils.LogLevel.INFO)
    cloud = k8sw.get_orchest_cloud_mode() == "True"

    stop()
    start(log_level, cloud)


def add_user(username: str, password: str, token: str, is_admin: str) -> None:
    """Adds a new user to Orchest.

    Args:
        username:
        password:
        token:
        is_admin:
    """

    db_depl, auth_server_depl = k8sw.get_orchest_deployments(
        ["orchest-database", "auth-server"]
    )

    if db_depl is None or db_depl.status.ready_replicas != db_depl.spec.replicas:
        utils.echo("The orchest-database service needs to be running.", err=True)
        raise typer.Exit(code=1)

    if (
        auth_server_depl is None
        or auth_server_depl.status.ready_replicas != auth_server_depl.spec.replicas
    ):
        utils.echo("The auth-server service needs to be running.", err=True)
        raise typer.Exit(code=1)

    pods = k8s_core_api.list_namespaced_pod(
        config.ORCHEST_NAMESPACE, label_selector="app=auth-server"
    )
    if not pods:
        utils.echo("Could not find auth-server pod.")
        raise typer.Exit(code=1)
    pod = pods[0]

    args = ["add_user.py", username, password]
    if token:
        args.append("--token")
        args.append(token)
    if is_admin:
        args.append("--admin")

    resp = stream(
        k8s_core_api.connect_get_namespaced_pod_exec,
        pod.metadata.name,
        config.ORCHEST_NAMESPACE,
        command=["python"],
        args=args,
        stderr=True,
        stdin=False,
        stdout=True,
        tty=False,
    )
    utils.echo(str(resp))


def update() -> None:
    """Stop Orchest then launches a orchest-ctl pod with hidden-update.

    When updating orchest from v1 to v2, orchest-ctl:v1 knows how to
    stop a orchest cluster on version v1, while orchest-ctl:v2 will
    update it to the new version. This leads to the following logic:
    - orchest update leads to a orchest-ctl:v1 pod
    - the pod will stop orchest
    - the pod will create a orchest-ctl:v2 pod
    - the orchest-ctl:v2 pod will actually update orchest
    - the orchest-ctl:v1 pod will get the logs of orchest-ctl:v2 and
      print them
    """
    k8sw.abort_if_unsafe()
    stop()
    pod = k8sw.create_update_pod()

    status = k8sw.wait_for_pod_status(
        pod.metadata.name,
        ["Succeeded", "Failed", "Unknown", "Running"],
        notify_progress_message="Waiting for update pod to come online.",
    )
    if status is None or status in ["Failed", "Unknown"]:
        utils.echo(
            f"Error while updating, update pod status: {status}. Cancelling update."
        )

    # We exec into the pod instead of running the command as the pod
    # command and following logs because this allows us to use a tty,
    # which will correctly render the progress bar.
    resp = stream.stream(
        k8s_core_api.connect_get_namespaced_pod_exec,
        pod.metadata.name,
        config.ORCHEST_NAMESPACE,
        container="orchest-ctl",
        stderr=True,
        stdin=True,
        stdout=True,
        tty=True,
        # Note that this will also take care of scaling the deployments,
        # i.e. Orchest will be STARTED after the update.
        command=["orchest", "hidden-update"],
        _preload_content=False,
    )
    while resp.is_open():
        resp.update()
        # nl=False, wrap=False to not disrupt the progress bar.
        if resp.peek_stdout():
            utils.echo(resp.read_stdout(), nl=False, wrap=False)
        if resp.peek_stderr():
            utils.echo(resp.read_stderr(), nl=False, wrap=False, err=True)


def _update() -> None:
    """Updates Orchest.

    This command should only be used internally, i.e. not called by
    a user through the CLI. This code will change the state of the
    deployment of Orchest. It assumes Orchest has been stopped.
    """
    utils.echo("Updating...")

    # Check if Orchest is actually stopped.
    depls = k8sw.get_orchest_deployments()
    depls = [
        depl.metadata.name
        for depl in depls
        if depl is not None and depl.spec.replicas > 0
    ]
    if depls:
        utils.echo(
            "Orchest is not stopped, thus the update operation cannot proceed. "
            f"Deployments that aren't stopped: {sorted(depls)}.",
            err=True,
        )
        raise typer.Exit(code=1)

    # K8S_TODO: delete user-built jupyter images.
    orchest_version = os.environ.get("ORCHEST_VERSION")
    if orchest_version is None:
        utils.echo(
            "Expected to find an ORCHEST_VERSION environment variable, exiting.",
            err=True,
        )
        raise typer.Exit(code=1)

    return_code = _run_helm_with_progress_bar(HelmMode.UPGRADE)
    if return_code != 0:
        utils.echo(
            f"There was an error while updating Orchest, exit code: {return_code} .",
            err=True,
        )
        raise typer.Exit(return_code)

    k8sw.set_orchest_cluster_version(orchest_version)

    # K8S_TODO: coordinate with ingress for this.
    # port = 8001
    # utils.echo(f"Orchest is running at: http://localhost:{port}")
    utils.echo("Update was successful.")
    utils.echo("Orchest is running, portforward to the webserver to access it.")
