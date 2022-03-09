import json
import logging
import os
import textwrap
from pathlib import Path

import typer

from _orchest.internals import config as _config
from app import config
from app.config import WRAP_LINES

logger = logging.getLogger(__name__)


def echo_json(data: dict) -> None:
    """Wraps typer.echo to output json in a consistent manner."""
    if not config.JSON_MODE:
        return
    typer.echo(json.dumps(data, sort_keys=True, indent=True))


def echo(*args, wrap=WRAP_LINES, **kwargs):
    """Wraps typer.echo to natively support line wrapping.

    If config.JSON_MODE is True no output will be produced.
    """
    if config.JSON_MODE:
        return
    if wrap:
        message = kwargs.get("message")
        if message is not None:
            kwargs["message"] = textwrap.fill(kwargs["message"], width=wrap)

        else:
            if args and args[0] is not None:
                args = (textwrap.fill(args[0], width=wrap), *args[1:])

    typer.echo(*args, **kwargs)


def fix_userdir_permissions() -> None:
    """Fixes the permissions on files and dirs in the userdir.

    Run setgid on all directories in the "userdir" to make sure new
    files created by containers are read/write for sibling containers
    and the host user.

    """
    try:
        # NOTE: The exit code is only returned on Unix systems
        # (which includes macOS).
        # Use the `-exec ... +` notation to try to pass all found files
        # to `chmod` at once and reduce the number of invocations.
        exit_code = os.system(
            "find /userdir -type d -not -perm -g+s -exec chmod g+s '{}' +"
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


def create_required_directories() -> None:
    for path in [
        _config.USERDIR_DATA,
        _config.USERDIR_JOBS,
        _config.USERDIR_PROJECTS,
        _config.USERDIR_ENV_IMG_BUILDS,
        _config.USERDIR_JUPYTER_IMG_BUILDS,
        _config.USERDIR_JUPYTERLAB,
        _config.USERDIR_BASE_IMAGES_CACHE,
    ]:
        Path(path).mkdir(parents=True, exist_ok=True)
