import logging
import os
import textwrap
import time
from typing import List, Union

import typer

from app.error import ENVVariableNotFoundError

logger = logging.getLogger(__name__)


def echo(*args, wrap=0, **kwargs):
    """Wraps typer.echo to natively support line wrapping."""
    if wrap:
        message = kwargs.get("message")
        if message is not None:
            kwargs["message"] = textwrap.fill(kwargs["message"], width=wrap)

        else:
            if args[0] is not None:
                args = (textwrap.fill(args[0], width=wrap), *args[1:])

    typer.echo(*args, **kwargs)


def get_env() -> dict:
    """Returns the min environment for container config construction."""
    env_vars = ["HOST_USER_DIR", "HOST_CONFIG_DIR", "HOST_REPO_DIR", "HOST_OS"]
    env = {var: os.environ.get(var) for var in env_vars}

    not_present = [var for var, value in env.items() if value is None]
    if not_present:
        raise ENVVariableNotFoundError(
            "Required environment variables are not present: "
            + ", ".join(not_present)
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
                wrap=72
            )


def wait_for_zero_exitcode(
    docker_client, container_id: str, cmd: Union[str, List[str]]
) -> None:
    """Waits for cmd to return an exit code of zero.

    The cmd is executed inside the container identified by
    `container_id`.

    """
    # This will likely take a maximum of 4 tries.
    exit_code = 1
    while exit_code != 0:
        exit_code = docker_client.exec_run(container_id, cmd)
        time.sleep(0.5)


def do_proxy_certs_exist_on_host() -> bool:
    """Checks whether the proxy certifications exist."""
    certs_path = "/orchest-host/services/nginx-proxy/certs/"

    crt_exists = os.path.isfile(os.path.join(certs_path, "server.crt"))
    key_exists = os.path.isfile(os.path.join(certs_path, "server.key"))

    return crt_exists and key_exists
