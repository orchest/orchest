import asyncio
from typing import Optional

import typer

from app import cmdline
from app import config
from app import utils
from app.cli import start as cli_start


app = typer.Typer(
    name="orchest",
    no_args_is_help=True,
    add_completion=False,
    help="""
    A tool for creating and running data science pipelines.
    """,
    short_help="Orchest CLI",
    epilog="Run 'orchest COMMAND --help' for more information on a command.",
)

app.add_typer(cli_start.app, name="start")


def __entrypoint():
    loop = asyncio.get_event_loop()
    utils.init_logger()
    app()
    loop.close()


@app.command()
def stop():
    """
    Stop Orchest.
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
    mode: Optional[str] = typer.Option(
        "reg", help="Mode in which to start Orchest afterwards."
    )
):
    """
    Restart Orchest.
    """
    if mode is not None:
        # Only mode that is given is "dev", used by the webserver and
        # in case the user would like to do so.
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
    typer.echo(f"Adding user {username}")
