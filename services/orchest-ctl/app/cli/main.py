import logging
import sys
from enum import Enum
from typing import Optional

import typer

from app import orchest
from app.cli import start as cli_start
from app.utils import echo


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
    json: bool = typer.Option(
        False,
        "--json",
        show_default=False,
        help="Get output in json.",
    ),
):
    """
    Get Orchest version.
    """
    orchest.version(ext=ext, output_json=json)


@typer_app.command()
def stop():
    """
    Shutdown Orchest.
    """
    orchest.stop()


@typer_app.command()
def status(
    json: bool = typer.Option(
        False,
        "--json",
        show_default=False,
        help="Get output in json.",
    ),
):
    """
    Get status of Orchest.

    The given status will be one of: "installing", "restarting",
    "running", "starting", "stopped", "stopping", "unhealthy" or
    "updating".

    """
    orchest.status(output_json=json)


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
    # Make sure the permissions of the userdir are correctly set in case
    # Orchest will always be started using `--cloud` in the future (as
    # in other modes the permissions are fixed on start).
    # K8S_TODO: is this still needed?
    # fix_userdir_permissions()
    orchest.install()


@typer_app.command()
def update():
    """
    Update Orchest.

    Note: when updating Orchest all running sessions and pipeline runs
    will be killed. Orchest can not be running during update.
    """
    orchest.update()


@typer_app.command(hidden=True)
def hidden_update():
    """Do not use unless you know what you are doing."""
    orchest._update()


@typer_app.command()
def restart(
    port: Optional[int] = typer.Option(8000, help="The port Orchest will listen on."),
    cloud: bool = typer.Option(
        False,
        show_default="--no-cloud",
        help=cli_start.__CLOUD_HELP_MESSAGE,
        hidden=True,
    ),
    dev: bool = typer.Option(
        False, show_default="--no-dev", help=cli_start.__DEV_HELP_MESSAGE
    ),
):
    """
    Restart Orchest.
    """

    orchest.restart()


@typer_app.command(hidden=True)
def adduser(
    username: str = typer.Argument(..., help="Name of the user to add."),
    set_token: bool = typer.Option(
        False, "--set-token", help="True if the token of the user is to be setup."
    ),
    is_admin: bool = typer.Option(
        False,
        show_default="--no-is-admin",
        help=(
            "If the newly created user should be an admin or not. An admin"
            " user cannot be deleted."
        ),
    ),
    non_interactive: bool = typer.Option(
        False, hidden=True, help="Use non interactive mode for password and token."
    ),
    non_interactive_password: Optional[str] = typer.Option(
        None, hidden=True, help="User password in non interactive mode."
    ),
    non_interactive_token: Optional[str] = typer.Option(
        None, hidden=True, help="User token in non interactive mode."
    ),
):
    """
    Add user to Orchest.
    """
    if non_interactive:
        password = non_interactive_password
        token = non_interactive_token
    else:
        if non_interactive_password:
            echo("Cannot use non_interactive_password in interactive mode.", err=True)
            raise typer.Exit(code=1)
        if non_interactive_token:
            echo("Cannot use non_interactive_token in interactive mode.", err=True)
            raise typer.Exit(code=1)

        password = typer.prompt("Password", hide_input=True, confirmation_prompt=True)
        if set_token:
            token = typer.prompt("Token", hide_input=True, confirmation_prompt=True)
        else:
            token = None

    if password is None:
        echo("Password must be specified.", err=True)
        raise typer.Exit(code=1)
    elif not password:
        echo("Password cannot be empty.", err=True)
        raise typer.Exit(code=1)
    if token is not None and not token:
        echo("Token cannot be empty.", err=True)
        raise typer.Exit(code=1)

    orchest.add_user(username, password, token, is_admin)
