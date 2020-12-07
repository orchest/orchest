import asyncio
from enum import Enum
import os
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
        help="Counter to set verbosity level, e.g. 'orchest -vvv start'",
    ),
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


class Language(str, Enum):
    python = "python"
    r = "r"
    all = "all"
    none = "none"


def __entrypoint():
    loop = asyncio.get_event_loop()
    app()
    loop.close()


@app.command()
def version(
    ext: Optional[bool] = typer.Option(
        None,
        "--ext",
        help="Get extensive version information.",
    ),
):
    """
    Get Orchest version.
    """
    if ext:
        version = cmdline.version()
        typer.echo(version)
    else:
        orchest_version = os.getenv("ORCHEST_VERSION")
        typer.echo(f"Orchest version {orchest_version}")


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
def install(
    language: Language = typer.Option(
        Language.python,
        "--lang",
        show_default=True,
        help="Language dependencies to install.",
    ),
    gpu: Optional[bool] = typer.Option(
        False,
        show_default="--no-gpu",
        help=(
            "Whether to install GPU supported images corresponding"
            " to the given language dependencies."
        ),
    ),
):
    """Install Orchest.

    Installation might take some time depending on your network
    bandwidth.
    """
    lang = language.value
    if gpu:
        lang += "-gpu"
    cmdline.install(lang)


@app.command()
def update(
    mode: Optional[str] = typer.Option(None, hidden=True),
    language: Language = typer.Option(
        Language.python,
        "--lang",
        show_default=True,
        help="Language dependencies to update.",
    ),
    gpu: Optional[bool] = typer.Option(
        False,
        show_default="--no-gpu",
        help=(
            "Whether to update GPU supported images corresponding"
            " to the given language dependencies."
        ),
    ),
):
    """
    Update Orchest.

    Will always update the core dependencies of Orchest. Using the
    '--lang' flag you can specify the language dependencies to update,
    where '--lang=none' will only get you the services that Orchest
    uses.
    """
    if mode is not None:
        # Only mode that is given is "web", used for the update-server.
        config.UPDATE_MODE = mode

    lang = language.value
    if gpu:
        lang += "-gpu"

    cmdline.update(language)


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
    config.CONTAINER_MAPPING["orchest/nginx-proxy:latest"]["ports"] = {
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
