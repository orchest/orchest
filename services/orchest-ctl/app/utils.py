import logging
import os
import subprocess
import textwrap
import time
from collections.abc import Mapping
from typing import List, Union

import typer

from app.config import WRAP_LINES
from app.error import ENVVariableNotFoundError

logger = logging.getLogger(__name__)


def echo(*args, wrap=WRAP_LINES, **kwargs):
    """Wraps typer.echo to natively support line wrapping."""
    if wrap:
        message = kwargs.get("message")
        if message is not None:
            kwargs["message"] = textwrap.fill(kwargs["message"], width=wrap)

        else:
            if args and args[0] is not None:
                args = (textwrap.fill(args[0], width=wrap), *args[1:])

    typer.echo(*args, **kwargs)


def get_env() -> dict:
    """Returns the min environment for container config construction."""
    env_vars = ["HOST_USER_DIR", "HOST_CONFIG_DIR", "HOST_REPO_DIR", "HOST_OS"]
    env = {var: os.environ.get(var) for var in env_vars}

    not_present = [var for var, value in env.items() if value is None]
    if not_present:
        raise ENVVariableNotFoundError(
            "Required environment variables are not present: " + ", ".join(not_present)
        )

    if env["HOST_OS"] == "darwin":
        # macOs UID/GID behaves differently with Docker bind mounts. For
        # the exact permission behaviour see:
        # https://github.com/docker/for-mac/issues/2657#issuecomment-371210749
        env["ORCHEST_HOST_GID"] = str(100)
    else:
        env["ORCHEST_HOST_GID"] = str(os.stat("/orchest-host/orchest").st_gid)

    return env


def fix_userdir_permissions() -> None:
    """Fixes the permissions on files and dirs in the userdir.

    Run setgid on all directories in the "userdir" to make sure new
    files created by containers are read/write for sibling containers
    and the host user.

    """
    try:
        # NOTE: The exit code is only returned on Unix systems
        # (which includes macOS).
        exit_code = os.system(
            "find /orchest-host/userdir -type d -exec chmod g+s {} \;"
        )
    except Exception as e:
        logger.warning("Could not set gid permissions on '/orchest-host/userdir'.")
        raise e from None
    else:
        if exit_code != 0:
            echo(
                "Could not set gid permissions on your userdir/. This is an extra"
                " check to make sure files created in Orchest are also read and"
                " writable directly on your host.",
            )


def wait_for_zero_exitcode(
    docker_client, container_id: str, cmd: Union[str, List[str]]
) -> None:
    """Waits for cmd to return an exit code of zero.

    The cmd is executed inside the container identified by
    `container_id`.

    """
    # This will likely take a maximum of 10 tries.
    exit_code = 1
    while exit_code != 0:
        exit_code = docker_client.exec_runs([(container_id, cmd)])[0]
        time.sleep(0.25)


def do_proxy_certs_exist_on_host() -> bool:
    """Checks whether the proxy certifications exist."""
    certs_path = "/orchest-host/services/nginx-proxy/certs/"

    crt_exists = os.path.isfile(os.path.join(certs_path, "server.crt"))
    key_exists = os.path.isfile(os.path.join(certs_path, "server.key"))

    return crt_exists and key_exists


def update_git_repo():
    """Pulls the latest changes from the Orchest git repository."""
    logger.info("Updating Orchest git repository to get the latest userdir changes...")
    script_path = os.path.join(
        "/orchest", "services", "orchest-ctl", "app", "scripts", "git-update.sh"
    )
    script_process = subprocess.Popen([script_path], cwd="/orchest-host", bufsize=0)
    exit_code = script_process.wait()

    return exit_code


def is_dangling(image: Mapping) -> bool:
    """Checks whether the given image is to be considered dangling."""
    tags = image["RepoTags"]
    return not tags or (len(tags) == 1 and tags[0] == "<none>:<none>")


# orchest <arguments> cmd <arguments>, excluding the use of cmd as an
# argument, so that "orchest --update update" would match but
# "orchest update update" would not.
ctl_command_pattern = r"^orchest(\s+(?!{cmd}\b)\S+)*\s+{cmd}(\s+(?!{cmd}\b)\S+)*\s*$"
