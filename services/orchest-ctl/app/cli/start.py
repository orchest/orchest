from typing import Optional

import typer

from app import cmdline, config


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
    )
):
    """
    Start Orchest in DEV mode.

    Starting Orchest in DEV mode mounts the repository code from the
    filesystem (and thus adhering to branches) to the appropriate paths
    in the Docker containers. This allows for active code changes being
    reflected inside the application.
    """
    config.CONTAINER_MAPPING["orchest/nginx-proxy:latest"]["ports"] = {
        "80/tcp": port,
        "443/tcp": 443,
    }
    config.RUN_MODE = "dev"
    cmdline.start()
