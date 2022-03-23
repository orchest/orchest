from enum import Enum
from typing import Optional

import typer
import validators

from app import orchest
from app.utils import LogLevel, echo, init_logger

__CLOUD_HELP_MESSAGE = (
    "Starting Orchest with --cloud changes GUI functionality. For example "
    "making it impossible to disable the authentication layer. Settings "
    "that cannot be modified through the GUI because of this flag, as "
    "all settings, can still be modified by changing the config.json "
    "configuration file directly."
)

# __DEV_HELP_MESSAGE = (
#     "Starting Orchest with --dev mounts the repository code from the "
#     "filesystem (and thus adhering to branches) to the appropriate
#     paths in " "the Docker containers. This allows for active code
#     changes being " "reflected inside the application. Moreover,
#     updating in dev mode " "makes it so that the git repository and
#     the orchest-ctl image are" "not updated."
# )


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
def start(
    log_level: Optional[LogLevel] = typer.Option(
        LogLevel.INFO,
        "-l",
        "--log-level",
        show_default=False,
        help="Log level inside the application.",
    ),
    cloud: bool = typer.Option(
        False, show_default="--no-cloud", help=__CLOUD_HELP_MESSAGE, hidden=True
    ),
):
    """
    Start Orchest.

    Alias:

    \b
        orchest start [OPTIONS]
    """
    # if dev:
    #     logger.info(
    #         "Starting Orchest with --dev. This mounts host directories
    #         " "to monitor for source code changes."
    #     )

    orchest.start(log_level, cloud)


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


def _validate_fqdn(fqdn: str) -> str:
    if not validators.domain(fqdn):
        raise typer.BadParameter(f"{fqdn} is not a valid domain.")
    return fqdn


def _validate_storage_class(storage_class: str) -> str:
    if not orchest.is_valid_storage_class(storage_class):
        raise typer.BadParameter(
            f"{storage_class} is not a storage class in the cluster."
        )
    return storage_class


@typer_app.command()
def install(
    log_level: Optional[LogLevel] = typer.Option(
        LogLevel.INFO,
        "-l",
        "--log-level",
        show_default=False,
        help="Log level inside the application.",
    ),
    cloud: bool = typer.Option(
        False, show_default="--no-cloud", help=__CLOUD_HELP_MESSAGE, hidden=True
    ),
    fqdn: Optional[str] = typer.Option(
        "localorchest.io",
        "--fqdn",
        show_default=True,
        help=(
            "Fully qualified domain name of the application. It can be used, for "
            "example, to reach the application locally after mapping the cluster ip "
            "to 'localorchest.io' in your /etc/hosts file. To do that, you can use "
            "'minikube ip' to get the cluster ip."
        ),
        callback=_validate_fqdn,
    ),
    registry_storage_class: Optional[str] = typer.Option(
        "standard",
        "--registry-storage",
        show_default=True,
        help=(
            "Storage class for the registry. When installing Orchest, a docker "
            "registry is deployed in the orchest namespace, this class reflects what "
            "storage should be used. The storage class must be defined in the cluster "
            "to be valid."
        ),
        callback=_validate_storage_class,
    ),
):
    """Install Orchest.

    Installation might take some time depending on your network
    bandwidth.
    """

    orchest.install(log_level, cloud, fqdn, registry_storage_class)


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
def restart():
    """
    Restart Orchest.
    """

    orchest.restart()


@typer_app.command()
def uninstall():
    """
    Uninstall Orchest.
    """

    orchest.uninstall()


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
