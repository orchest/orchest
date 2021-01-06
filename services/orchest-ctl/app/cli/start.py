import logging
from enum import Enum
from typing import Optional

import typer

from app import cmdline, config

logger = logging.getLogger(__name__)


def _default(
    ctx: typer.Context,
    port: Optional[int] = typer.Option(
        8000, help="The port the Orchest webserver will listen on."
    ),
):
    if ctx.invoked_subcommand is None:
        reg(port=port)


app = typer.Typer(
    name="start",
    invoke_without_command=True,
    add_completion=False,
    help="""
    Start Orchest.
    """,
    epilog="Run 'orchest start COMMAND --help' for more information on a command.",
    callback=_default,
)


class LogLevel(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"


@app.command()
def reg(
    port: Optional[int] = typer.Option(
        8000, help="The port the Orchest webserver will listen on."
    )
):
    """
    Start Orchest regularly.

    This is the default mode in which Orchest is started. Alias:

    \b
        orchest start [OPTIONS]
    """
    config.CONTAINER_MAPPING["orchest/nginx-proxy:latest"]["ports"] = {
        "80/tcp": port,
        "443/tcp": 443,
    }
    cmdline.start()


@app.command()
def dev(
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
):
    """
    Start Orchest in DEV mode.

    Starting Orchest in DEV mode mounts the repository code from the
    filesystem (and thus adhering to branches) to the appropriate paths
    in the Docker containers. This allows for active code changes being
    reflected inside the application.
    """
    logger.info(
        "Starting Orchest in DEV mode. This mounts host directories "
        "to monitor for source code changes."
    )

    # TODO: This is not really the cleanest way to inject into the
    # config object.
    config.CONTAINER_MAPPING["orchest/nginx-proxy:latest"]["ports"] = {
        "80/tcp": port,
        "443/tcp": 443,
    }

    if log_level is not None:
        containers = [
            "orchest/orchest-api:latest",
            "orchest/orchest-webserver:latest",
            "orchest/auth-server:latest",
            "orchest/celery-worker:latest",
        ]
        for c in containers:
            config.CONTAINER_MAPPING[c]["environment"][
                "ORCHEST_LOG_LEVEL"
            ] = log_level.value

    config.RUN_MODE = "dev"
    cmdline.start()
