"""Core functionality of orchest-ctl."""
import logging
import os
import subprocess
import time

import typer
from kubernetes import client as k8s_client

from app import config, utils
from app.connections import k8s_core_api
from app.orchest import _k8s_wrapper as k8sw

logger = logging.getLogger(__name__)


def is_orchest_already_installed() -> bool:
    try:
        k8s_core_api.read_namespace(config.ORCHEST_NAMESPACE)
    except k8s_client.ApiException as e:
        if e.status == 404:
            return False
    deployments = k8sw.get_orchest_deployments()
    if all(deployments):
        return True
    elif not any(deployments):
        return False
    else:
        utils.echo(
            "Unexpected Orchest installation state. Expected to find no deployments at "
            "all or a complete installation. Please verify your installation.",
            err=True,
        )
        raise typer.Exit(code=1)


def install():
    if is_orchest_already_installed():
        utils.echo("Installation is already complete. Did you mean to run:")
        utils.echo("\torchest update")
        return
    # "When running a command via kubectl run -it that immediately prints
    # something, we might lose some lines of the log due to a race of the
    # execution of the container and the kubectl attach used by kubectl run to
    # attach to the terminal (compare comment #16670 (comment))."
    # https://github.com/kubernetes/kubernetes/issues/27264
    # K8S_TODO: find a workaround.
    utils.echo("Installing...")

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
        length=len(config.ORCHEST_DEPLOYMENTS),
        label="Installation",
        show_eta=False,
    ) as progress:
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
    # K8S_TODO: coordinate with ingress for this.
    # port = 8001
    # utils.echo(f"Orchest is running at: http://localhost:{port}")
    utils.echo("Installation was successful.")
