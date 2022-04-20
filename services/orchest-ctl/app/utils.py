import json
import logging
import sys
import textwrap
from enum import Enum

import typer

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
    with open("/config/config.json") as orchest_config_file:
        orchest_config = json.load(orchest_config_file)
    return orchest_config


def set_orchest_config(orchest_config: dict) -> dict:
    """Sets the Orchest configuration, i.e. saves the dict."""
    with open("/config/config.json", "w") as orchest_config_file:
        json.dump(orchest_config, orchest_config_file)


def get_celery_parallelism_level_from_config() -> dict:
    orc_config = get_orchest_config()
    runs_k = "MAX_INTERACTIVE_RUNS_PARALLELISM"
    jobs_k = "MAX_JOB_RUNS_PARALLELISM"
    return {
        runs_k: orc_config.get(runs_k, 1),
        jobs_k: orc_config.get(jobs_k, 1),
    }
