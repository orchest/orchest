import logging
from enum import Enum
from typing import Optional

import typer

from app import orchest

logger = logging.getLogger(__name__)

__CLOUD_HELP_MESSAGE = (
    "Starting Orchest with --cloud changes GUI functionality. For example "
    "making it impossible to disable the authentication layer. Settings "
    "that cannot be modified through the GUI because of this flag, as "
    "all settings, can still be modified by changing the config.json "
    "configuration file directly."
)

__DEV_HELP_MESSAGE = (
    "Starting Orchest with --dev mounts the repository code from the "
    "filesystem (and thus adhering to branches) to the appropriate paths in "
    "the Docker containers. This allows for active code changes being "
    "reflected inside the application. Moreover, updating in dev mode "
    "makes it so that the git repository and the orchest-ctl image are"
    "not updated."
)


class LogLevel(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"


def _default(
    ctx: typer.Context,
    port: Optional[int] = typer.Option(
        8000, help="The port the Orchest webserver will listen on."
    ),
    log_level: Optional[LogLevel] = typer.Option(
        None,
        "-l",
        "--log-level",
        show_default=False,
        help="Log level inside the application.",
    ),
    cloud: bool = typer.Option(
        False,
        show_default="--no-cloud",
        help=__CLOUD_HELP_MESSAGE,
        hidden=True,
    ),
    dev: bool = typer.Option(False, show_default="--no-dev", help=__DEV_HELP_MESSAGE),
):
    if ctx.invoked_subcommand is None:
        reg(port, log_level, cloud, dev)


typer_app = typer.Typer(
    name="start",
    invoke_without_command=True,
    add_completion=False,
    help="""
    Start Orchest.
    """,
    # epilog="Run 'orchest start COMMAND --help' for more
    # information on a command.",
    callback=_default,
)


@typer_app.command(hidden=True)
def reg(
    port: Optional[int] = typer.Option(
        8000, help="The port the Orchest webserver will listen on."
    ),
    log_level: Optional[LogLevel] = typer.Option(
        None,
        "-l",
        "--log-level",
        show_default=False,
        help="Log level inside the application.",
    ),
    cloud: bool = typer.Option(
        False, show_default="--no-cloud", help=__CLOUD_HELP_MESSAGE, hidden=True
    ),
    dev: bool = typer.Option(False, show_default="--no-dev", help=__DEV_HELP_MESSAGE),
):
    """
    Start Orchest.

    Alias:

    \b
        orchest start [OPTIONS]
    """
    if dev:
        logger.info(
            "Starting Orchest with --dev. This mounts host directories "
            "to monitor for source code changes."
        )

    # K8S_TODO: decide what to do/how to do DEV/CLOUD and other args
    # passing.
    orchest.start()
