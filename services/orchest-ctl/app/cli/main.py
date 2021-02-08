import logging
import sys
from enum import Enum
from typing import Optional

import typer

from app.cli import start as cli_start
from app.orchest import OrchestApp
from app.spec import get_container_config, inject_dict


# TODO: utils.py
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
    init_logger(verbosity=verbosity)


typer_app = typer.Typer(
    name="orchest",
    no_args_is_help=True,
    add_completion=False,
    help="""
    An IDE for Data Science.
    """,
    short_help="Orchest CLI",
    epilog="Run 'orchest COMMAND --help' for more information on a command.",
    callback=_default,
)

typer_app.add_typer(cli_start.typer_app, name="start")

app = OrchestApp()


class Mode(str, Enum):
    reg = "reg"
    dev = "dev"


class Language(str, Enum):
    python = "python"
    r = "r"
    julia = "julia"
    all = "all"
    none = "none"


def __entrypoint():
    typer_app()


@typer_app.command()
def version(
    ext: bool = typer.Option(
        False,
        "--ext",
        show_default=False,
        help="Get extensive version information.",
    ),
):
    """
    Get Orchest version.
    """
    app.version(ext=ext)


@typer_app.command()
def stop():
    """
    Shutdown Orchest.
    """
    app.stop()


@typer_app.command()
def status():
    """
    Get status of Orchest.
    """
    app.status()


@typer_app.command()
def debug_dump():
    """
    Create a debug dump of Orchest.
    """
    app.debug_dump()


@typer_app.command()
def install(
    language: Language = typer.Option(
        Language.python,
        "--lang",
        show_default=True,
        help="Language dependencies to install.",
    ),
    gpu: bool = typer.Option(
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
    app.install(language, gpu=gpu)


# TODO: make mode in Mode type. Although it is "web" here
@typer_app.command()
def update(
    mode: Optional[str] = typer.Option(None, hidden=True),
):
    """
    Update Orchest.

    Will always update the core dependencies of Orchest. Using the
    '--lang' flag you can specify the language dependencies to update,
    where '--lang=none' will only get you the services that Orchest
    uses.
    """
    app.update(mode=mode)


@typer_app.command()
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
    container_config = get_container_config(mode.value)
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
    app.restart(container_config)


@typer_app.command(hidden=True)
def updateserver():
    """
    Update Orchest through the update-server.
    """
    app._updateserver()
