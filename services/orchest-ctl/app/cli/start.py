import logging
from enum import Enum
from typing import Optional

import typer

from app.orchest import OrchestApp
from app.spec import get_container_config, inject_dict

logger = logging.getLogger(__name__)


def _default(
    ctx: typer.Context,
    port: Optional[int] = typer.Option(
        8000, help="The port the Orchest webserver will listen on."
    ),
):
    if ctx.invoked_subcommand is None:
        reg(port=port)


typer_app = typer.Typer(
    name="start",
    invoke_without_command=True,
    add_completion=False,
    help="""
    Start Orchest.
    """,
    epilog="Run 'orchest start COMMAND --help' for more information on a command.",
    callback=_default,
)

app = OrchestApp()


class LogLevel(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"


@typer_app.command()
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
    container_config = get_container_config("reg")

    port_bind: dict = {
        "nginx-proxy": {
            "HostConfig": {
                "PortBindings": {
                    "80/tcp": [{"HostPort": f"{port}"}],
                },
            },
        },
    }
    inject_dict(container_config, port_bind, overwrite=True)
    app.start(container_config)


@typer_app.command()
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
    container_config = get_container_config("dev")

    port_bind: dict = {
        "nginx-proxy": {
            "HostConfig": {
                "PortBindings": {
                    "80/tcp": [{"HostPort": f"{port}"}],
                },
            },
        },
    }
    inject_dict(container_config, port_bind, overwrite=True)

    if log_level is not None:
        logging_env = f"ORCHEST_LOG_LEVEL={log_level.value}"
        log_levels: dict = {
            "orchest-webserver": {
                "Env": [logging_env],
            },
            "orchest-api": {
                "Env": [logging_env],
            },
            "auth-server": {
                "Env": [logging_env],
            },
            "celery-worker": {
                "Env": [logging_env],
            },
        }
        inject_dict(container_config, log_levels, overwrite=False)

    logger.info(
        "Starting Orchest in DEV mode. This mounts host directories "
        "to monitor for source code changes."
    )
    app.start(container_config)
