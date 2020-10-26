import asyncio
from enum import Enum
from typing import Optional

import typer

from app import cmdline
from app import config
from app import utils
from app.cli import start as cli_start


def _default(
    verbosity: int = typer.Option(
        0,
        "--verbose",
        "-v",
        count=True,
        show_default=False,
        max=3,
        clamp=True,
        help="Counter to set verbosity level, e.g. -vvv",
    )
):
    utils.init_logger(verbosity=verbosity)


app = typer.Typer(
    name="orchest",
    no_args_is_help=True,
    add_completion=False,
    help="""
    A tool for creating and running data science pipelines.
    """,
    short_help="Orchest CLI",
    epilog="Run 'orchest COMMAND --help' for more information on a command.",
    callback=_default,
)

app.add_typer(cli_start.app, name="start")


class Mode(str, Enum):
    reg = "reg"
    dev = "dev"


def __entrypoint():
    loop = asyncio.get_event_loop()
    app()
    loop.close()


@app.command()
def stop():
    """
    Shutdown Orchest.
    """
    cmdline.stop()


@app.command()
def status():
    """
    Get status of Orchest.
    """
    cmdline.status()


@app.command()
def update(mode: Optional[str] = typer.Option(None, hidden=True)):
    """
    Update Orchest.
    """
    if mode is not None:
        # Only mode that is given is "web", used for the update-server.
        config.UPDATE_MODE = mode
    cmdline.update()


@app.command()
def restart(
    mode: Mode = typer.Option(
        Mode.reg, help="Mode in which to start Orchest afterwards."
    ),
    port: Optional[int] = typer.Option(
        8000, help="The port the Orchest webserver will listen on."
    ),
):
    """
    Restart Orchest.
    """
    config.CONTAINER_MAPPING["orchestsoftware/nginx-proxy:latest"]["ports"] = {
        "80/tcp": port,
        "443/tcp": 443,
    }

    config.RUN_MODE = mode
    cmdline.restart()


@app.command(hidden=True)
def updateserver():
    """
    Update Orchest through the update-server.
    """
    cmdline._updateserver()


@app.command(hidden=True)
def adduser(
    username: str = typer.Argument(..., help="Username to add to Orchest"),
    password: str = typer.Option(
        ..., prompt=True, confirmation_prompt=True, hide_input=True
    ),
):
    """
    Add user to Orchest.
    """
    # TODO: once we do authentication
    typer.echo(f"Adding user {username}")
