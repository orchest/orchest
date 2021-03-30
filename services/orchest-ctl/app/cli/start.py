import logging
from typing import Optional

import typer

from app.orchest import OrchestApp
from app.spec import LogLevel, get_container_config, inject_dict

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
    "reflected inside the application."
)


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

app = OrchestApp()


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
    container_config = get_container_config(cloud, dev, log_level)

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

    if dev:
        logger.info(
            "Starting Orchest with --dev. This mounts host directories "
            "to monitor for source code changes."
        )

    app.start(container_config)
