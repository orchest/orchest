import json
import logging
import os
import sys
import textwrap
from enum import Enum
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
        _config.USERDIR_KANIKO_BASE_IMAGES_CACHE,
        _config.USERDIR_BUILDKIT_CACHE,
    ]:
        Path(path).mkdir(parents=True, exist_ok=True)


class LogLevel(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"


def init_logger(verbosity=0):
    """Initialize logger.

    The logging module is used to output to STDOUT for the CLI.

    Args:
        verbosity: The level of verbosity to use. Corresponds to the
        logging levels:
            3 DEBUG
            2 INFO
            1 WARNING
            0 ERROR

    """
    levels = [logging.ERROR, logging.WARNING, logging.INFO, logging.DEBUG]
    logging.basicConfig(level=levels[verbosity])

    root = logging.getLogger()
    if len(root.handlers) > 0:
        h = root.handlers[0]
        root.removeHandler(h)

    formatter = logging.Formatter("%(levelname)s: %(message)s")
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    root.addHandler(handler)


def get_orchest_config() -> dict:
    """Gets the Orchest configuration."""
    with open("/config/config.json") as config_file:
        config = json.load(config_file)
    return config


def get_celery_parallelism_level() -> dict:
    orc_config = get_orchest_config()
    runs_k = "MAX_INTERACTIVE_RUNS_PARALLELISM"
    jobs_k = "MAX_JOB_RUNS_PARALLELISM"
    return {
        runs_k: orc_config.get(runs_k, 1),
        jobs_k: orc_config.get(jobs_k, 1),
    }
