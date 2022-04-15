"""The Orchest CLI.

Polling the API from your browser:
    kubectl proxy --port=8000
Then go to a URL, e.g:
http://localhost:8000/apis/orchest.io/v1alpha1/namespaces/orchest/orchestclusters/cluster-1

Example working with custom objects:
https://github.com/kubernetes-client/python/blob/v21.7.0/kubernetes/docs/CustomObjectsApi.md

"""
# TODO:
# - Do we want to split the CLI commands into two modules: application
#   and management? cmds_management.py
# - Use `rich` to echo instead of `click`.
#       - Loaders
#       - Parsed line length
#       All spinner libraries seem to be manipulating an output stream,
#       where they write to it, clear the current line, and write to it
#       in a loop. But not sure how to make sure this is compatible cross
#       operating systems.

import collections
import enum
import json
import sys
import time
import typing as t
from gettext import gettext

import click
from kubernetes import client, config, stream

if t.TYPE_CHECKING:
    from multiprocessing.pool import AsyncResult

# https://github.com/kubernetes-client/python/blob/v21.7.0/kubernetes/docs/CustomObjectsApi.md
config.load_kube_config()
CUSTOM_OBJECT_API = client.CustomObjectsApi()
CORE_API = client.CoreV1Api()

# TODO: config values
NAMESPACE = "orchest"
ORCHEST_CLUSTER_NAME = "cluster-1"
APPLICATION_CMDS = ["adduser"]


def echo(*args, **kwargs) -> None:
    """Wrapped `click.echo`.

    Note:
        Will do nothing in case the current CLI command is invoked with
        the `--json` flag.

    """
    click_ctx = click.get_current_context()
    if click_ctx is None:
        return click.echo(*args, **kwargs)
    elif click_ctx.params.get("json_flag") is True:
        return
    else:
        return click.echo(*args, **kwargs)


JECHO_CALLS = 0


def jecho(*args, **kwargs) -> None:
    """JSON echo."""
    # Invoking `jecho` multiple times within one CLI invocation would
    # mean that the final output is not JSON parsable.
    global JECHO_CALLS
    assert JECHO_CALLS == 0, "`jecho` should only be called once per CLI invocation."
    JECHO_CALLS += 1

    message = kwargs.get("message")
    if message is not None:
        kwargs["message"] = json.dumps(message, sort_keys=True, indent=True)
    else:
        if args and args[0] is not None:
            args = (json.dumps(args[0], sort_keys=True, indent=True), *args[1:])
    return click.echo(*args, **kwargs)  # type: ignore


class CRObjectNotFound(Exception):
    """CR Object defining Orchest Cluster not found."""

    pass


class ClickCommonOptionsCmd(click.Command):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Add the common commands to the beginning of the list so that
        # they are displayed first in the help menu.
        self.params: t.List[click.Option] = [
            click.Option(
                ("-n", "--namespace"),
                default=NAMESPACE,
                show_default=True,
                help="Namespace of Orchest Cluster.",
            ),
            click.Option(
                ("-c", "--cluster-name"),
                default=ORCHEST_CLUSTER_NAME,
                show_default=True,
                help="Name of Orchest Cluster.",
            ),
        ] + self.params


class ClickHelpCategories(click.Group):
    def format_commands(
        self, ctx: click.Context, formatter: click.HelpFormatter
    ) -> None:
        """Extra format methods for multi methods that adds all the commands
        after the options.
        """
        commands = []
        for subcommand in self.list_commands(ctx):
            cmd = self.get_command(ctx, subcommand)
            # What is this, the tool lied about a command.  Ignore it
            if cmd is None:
                continue
            if cmd.hidden:
                continue

            commands.append((subcommand, cmd))

        # allow for 3 times the default spacing
        if len(commands):
            limit = formatter.width - 6 - max(len(cmd[0]) for cmd in commands)

            categories: t.Dict[
                str, t.List[t.Tuple[str, str]]
            ] = collections.defaultdict(list)
            for subcommand, cmd in commands:
                help = cmd.get_short_help_str(limit)

                # TODO: Instead we could make it into a separate click
                # group and add both groups to the cli entrypoint group.
                if subcommand in APPLICATION_CMDS:
                    categories["Application Commands"].append((subcommand, help))
                else:
                    categories["Cluster Management Commands"].append((subcommand, help))

            if categories:
                for category, rows in categories.items():
                    with formatter.section(gettext(category)):
                        formatter.write_dl(rows)


@click.group(
    context_settings={
        "help_option_names": ["-h", "--help"],
    },
    cls=ClickHelpCategories,
)
def cli():
    """The Orchest CLI to manage your Orchest Cluster on Kubernetes.

    \b
    Exit status:
        0   if OK,
        1   if Failure.

    """
    pass


# TODO: Easy point of breakage between versions of the CLI that needs
# to communicate with the CR Object. So we need to make a great first
# design for the different cluster statuses.
# NOTE: Schema to be kept in sync with:
# `services/orchest-controller/pkg/apis/orchest/v1alpha1/types.go`
class ClusterStatus(enum.Enum):
    INITIALIZING = "Initializing"
    DEPLOYING_ARGO = "Deploying Argo"
    DEPLOYING_REGISTRY = "Deploying Registry"
    DEPLOYING_ORCHEST_CONTROL_PLANE = "Deploying Orchest Control Plane"
    DEPLOYING_ORCHEST_RESOURCES = "Deploying Orchest Resources"
    RESTARTING = "Restarting"
    STARTING = "Starting"
    STOPPING = "Stopping"
    STOPPED = "Stopped"
    UNHEALTHY = "Unhealthy"
    PENDING = "Pending"
    DELETING = "Deleting"
    RUNNING = "Running"
    UPDATING = "Updating"
    ERROR = "Error"


@cli.command(cls=ClickCommonOptionsCmd)
def install(**common_options) -> None:
    """Install Orchest."""
    ns, cluster_name = common_options["namespace"], common_options["cluster_name"]

    # TODO: Do we want to put everything in JSON? Probably easier to
    # merge it with flags passed by the user.
    custom_object = {
        "apiVersion": "orchest.io/v1alpha1",
        "kind": "OrchestCluster",
        "metadata": {
            "name": cluster_name,
            "namespace": ns,
        },
        "spec": {
            "singleNode": True,
            "orchest": {
                "nodeAgent": {"image": "orchest/node-agent"},
            },
        },
    }

    # Once the CR is created, the operator will read it and start
    # setting up the Orchest Cluster.
    try:
        CUSTOM_OBJECT_API.create_namespaced_custom_object(
            group="orchest.io",
            version="v1alpha1",
            namespace=ns,
            plural="orchestclusters",
            body=custom_object,
        )
    except client.ApiException as e:
        echo("Failed to install Orchest.")
        if e.status == 409:  # conflict
            echo("Orchest is already installed. To update, run:")
            echo("\torchest update")
        else:
            echo("Could not create the required namespaced custom object.")
        sys.exit(1)

    echo("Setting up the Orchest Cluster...", nl=True)
    try:
        # NOTE: Click's `echo` makes sure the ANSI characters work
        # cross-platform. For Windows it uses `colorama` to do so.
        echo("\033[?25l", nl=False)  # hide cursor

        # NOTE: Watching (using `watch.Watch().stream(...)`) is not
        # supported, thus we go for a loop instead:
        # https://github.com/kubernetes-client/python/issues/1679
        prev_status = ClusterStatus.INITIALIZING
        curr_status = ClusterStatus.INITIALIZING
        end_status = ClusterStatus.RUNNING

        # Use `async_req` to make sure spinner is always loading.
        thread = _get_namespaced_custom_object(ns, cluster_name, async_req=True)
        while curr_status != end_status:
            thread = t.cast("AsyncResult", thread)
            if thread.ready():
                curr_status = _parse_cluster_status_from_custom_object(thread.get())
                thread = _get_namespaced_custom_object(ns, cluster_name, async_req=True)

            if curr_status is None:
                curr_status = prev_status

            if curr_status == prev_status:
                for _ in range(3):  # 3 * (0.2 + 0.2) = 1.2
                    echo("\r", nl=False)  # Move cursor to beginning of line
                    echo("\033[K", nl=False)  # Erase until end of line
                    echo(f"🚶 {curr_status.value}", nl=False)
                    time.sleep(0.2)
                    echo("\r", nl=False)
                    echo("\033[K", nl=False)
                    echo(f"🏃 {curr_status.value}", nl=False)
                    time.sleep(0.2)

            else:
                echo("\r", nl=False)
                echo("\033[K", nl=False)
                echo(f"🏁 {prev_status.value}", nl=True)
                prev_status = curr_status

                # Otherwise we would wait without reason once installation
                # has finished.
                if curr_status != end_status:
                    time.sleep(1.2)
    finally:
        echo("\033[?25h", nl=False)  # show cursor

    echo("Successfully installed Orchest!")


@cli.command(cls=ClickCommonOptionsCmd)
@click.option(
    "--json",
    "json_flag",  # name for arg
    is_flag=True,
    default=False,
    show_default=False,
    help="Get output in json.",
)
def version(json_flag: bool, **common_options) -> None:
    """Get running Orchest version.

    \b
    Equivalent `kubectl` command:
        kubectl -n <namespace> get orchestclusters <cluster-name> -o jsonpath="{.spec.orchest.defaultTag}"

    """
    try:
        custom_object = _get_namespaced_custom_object(
            common_options["namespace"],
            common_options["cluster_name"],
        )
    except CRObjectNotFound as e:
        if json_flag:
            jecho({})
        else:
            echo("Failed to fetch Orchest Cluster version.", err=True)
            echo(e, err=True)
        sys.exit(1)

    version = custom_object["spec"]["orchest"]["defaultTag"]  # type: ignore

    if json_flag:
        jecho({"version": version})
    else:
        echo(version)


# TODO: Add to docstring what the possible statuses are and how
# to interpret them.
@cli.command(cls=ClickCommonOptionsCmd)
@click.option(
    "--json",
    "json_flag",  # name for arg
    is_flag=True,
    default=False,
    show_default=False,
    help="Get output in json.",
)
def status(json_flag: bool, **common_options) -> None:
    """Get Orchest Cluster status.

    If invoked with `--json`, then failure to get Orchest Cluster status
    will return an empty JSON Object, i.e. `{}`.

    \b
    Equivalent `kubectl` command:
        kubectl -n <namespace> get orchestclusters <cluster-name> -o jsonpath="{.status.message}"

    """
    ns, cluster_name = common_options["namespace"], common_options["cluster_name"]

    # NOTE: If an uncaught exception is raised, Python will exit with
    # exit code equal to 1.
    try:
        status = _get_orchest_cluster_status(ns, cluster_name)
    except CRObjectNotFound as e:
        if json_flag:
            jecho({})
        else:
            echo("Failed to fetch Orchest Cluster status.", err=True)
            echo(e, err=True)
        sys.exit(1)

    if status is None:
        echo("Failed to fetch Orchest Cluster status. Please try again.", err=True)
    else:
        if json_flag:
            jecho({"status": status.value})
        else:
            echo(status.value)


@cli.command(cls=ClickCommonOptionsCmd)
@click.argument("username")
@click.option(
    "--is-admin",
    is_flag=True,
    default=False,
    show_default=False,
    help="Whether to make the user an admin.",
)
@click.option(
    "--non-interactive",
    is_flag=True,
    default=False,
    show_default=False,
    help="Use non-interactive mode for password and token.",
)
@click.option(
    "--non-interactive-password",
    default=None,
    show_default=False,
    help="User password, provided non-interactively.",
)
@click.option(
    "--set-token",
    is_flag=True,
    default=False,
    show_default=False,
    help="Prompt asking for a machine token to identify user with.",
)
@click.option(
    "--non-interactive-token",
    default=None,
    show_default=False,
    help="Machine token to identify user with, provided non-interactively.",
)
def adduser(
    username: str,
    is_admin: bool,
    non_interactive: bool,
    non_interactive_password: t.Optional[str],
    set_token: bool,
    non_interactive_token: t.Optional[str],
    **common_options,
) -> None:
    """Add a new user to Orchest.

    \b
    Usage:
        # Adding a new user non-interactively. This can be useful for
        # automations.
        orchest adduser UserName --non-interactive --non-interactive-password=password
        \b
        # Get prompts to enter password and machine token.
        orchest adduser UserName --set-token
    """
    # TODO: Extract gate once we introduce more application commands.
    ns, cluster_name = common_options["namespace"], common_options["cluster_name"]
    try:
        status = _get_orchest_cluster_status(ns, cluster_name)
    except CRObjectNotFound as e:
        echo(f"Failed to add specified user: {username}.", err=True)
        echo(e, err=True)
        sys.exit(1)

    if status != ClusterStatus.RUNNING:
        echo(
            "Orchest is currently unable to add a new user, because the Orchest"
            f" Cluster is '{'unknown' if status is None else status.value}'.",
            err=True,
        )
        echo(
            "Please try again once the Orchest Cluster is"
            f" '{ClusterStatus.RUNNING.value}', see:"
            "\n\torchest status",
            err=True,
        )
        sys.exit(1)

    if non_interactive:
        password = non_interactive_password
        token = non_interactive_token
    else:
        if non_interactive_password:
            echo(
                "Can't use `--non-interactive-password` without `--non-interactive`",
                err=True,
            )
            sys.exit(1)
        if non_interactive_token:
            echo(
                "Can't use `--non-interactive-token` without `--non-interactive`",
                err=True,
            )
            sys.exit(1)

        password = click.prompt("Password", hide_input=True, confirmation_prompt=True)
        if set_token:
            token = click.prompt("Token", hide_input=True, confirmation_prompt=True)
        else:
            token = None

    try:
        _add_user(ns, cluster_name, username, password, is_admin, token)
    except ValueError as e:
        echo(f"Failed to add specified user: {username}.", err=True)
        echo(e, err=True)
        sys.exit(1)
    except RuntimeError as e:
        echo(f"Failed to add specified user: {username}.", err=True)
        # NOTE: A newline is already returned by the auth-server.
        echo(e, err=True, nl=False)
        sys.exit(1)

    echo(f"Successfully added {'admin' if is_admin else ''} user: {username}.")


def _add_user(
    ns: str,
    cluster_name: str,
    username: str,
    password: t.Optional[str],
    is_admin: bool,
    token: t.Optional[str],
) -> None:
    if password is None:
        raise ValueError("Password must be specified")
    elif not password:
        raise ValueError("Password can't be empty.")
    if token is not None and not token:
        raise ValueError("Token can't be empty.")

    pods = CORE_API.list_namespaced_pod(
        ns,
        label_selector=(
            "contoller.orchest.io/component=auth-server,"
            f"controller.orchest.io={cluster_name}"
        ),
    )
    if not pods:
        raise RuntimeError(
            "Orchest Cluster is in an invalid state: no authentication server"
            " ('auth-server') found."
        )
    elif len(pods.items) > 1:
        raise RuntimeError(
            "Orchest Cluster is in an invalid state: multiple authentication"
            " servers ('auth-server') found."
        )
    else:
        auth_server_pod = pods.items[0]

    command = ["python", "add_user.py", username, password]
    if token is not None:
        command.append("--token")
        command.append(token)
    if is_admin:
        command.append("--is_admin")

    client = stream.stream(
        CORE_API.connect_get_namespaced_pod_exec,
        name=auth_server_pod.metadata.name,
        namespace=ns,
        command=command,
        stderr=True,
        stdin=False,
        stdout=True,
        tty=False,
        # Gives us a WS client so we can get the return code.
        _preload_content=False,
    )
    # NOTE: Timeout shouldn't be needed, but we don't want to keep the
    # WS connection open indefinitely if something goes wrong in the
    # auth-server.
    client.run_forever(timeout=20)
    if client.returncode != 0:
        raise RuntimeError(client.read_all())


def _get_orchest_cluster_status(
    ns: str, cluster_name: str
) -> t.Optional[ClusterStatus]:
    """

    Note:
        Passes `kwargs` to underlying `get_namespaced_custom_object`
        call.

    Returns:
        multiprocessing.pool.AsyncResult if `async_req=True`,
        None if custom object did contain `status` entry,
        the status of the custom object otherwise.

    Raises:
        CRObjectNotFound: Custom Object could not be found.

    """
    # TODO: The moment the `/status` endpoint is implemented we can
    # switch to `CUSTOM_OBJECT_API.get_namespaced_custom_object_status`
    custom_object = _get_namespaced_custom_object(ns, cluster_name)
    custom_object = t.cast(t.Dict, custom_object)
    return _parse_cluster_status_from_custom_object(custom_object)


def _parse_cluster_status_from_custom_object(
    custom_object: t.Dict,
) -> t.Optional[ClusterStatus]:
    try:
        # TODO: Introduce more granularity later and add `message`
        status = ClusterStatus(custom_object["status"]["state"])
    except KeyError:
        # NOTE: KeyError can get hit due to `"status"` not (yet) being
        # present in the response:
        # https://github.com/kubernetes-client/python/issues/1772
        return None

    return status


def _get_namespaced_custom_object(
    ns: str, cluster_name: str, **kwargs
) -> t.Union[t.Dict, "AsyncResult"]:
    """

    Note:
        Passes `kwargs` to underlying `get_namespaced_custom_object`
        call.

    Returns:
        multiprocessing.pool.AsyncResult if `async_req=True`,
        the custom object otherwise.

    Raises:
        CRObjectNotFound: Custom Object could not be found.

    """
    try:
        custom_object = CUSTOM_OBJECT_API.get_namespaced_custom_object(
            group="orchest.io",
            version="v1alpha1",
            name=cluster_name,
            namespace=ns,
            plural="orchestclusters",
            **kwargs,
        )
    except client.ApiException as e:
        if e.status == 404:  # not found
            raise CRObjectNotFound(
                f"The Orchest Cluster named '{cluster_name}' in namespace"
                f" '{ns}' could not be found."
            )
        else:
            raise

    return custom_object
