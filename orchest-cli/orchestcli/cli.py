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

import enum
import json
import sys
import time
from typing import Dict, Optional

import click
from kubernetes import client, config, stream

# https://github.com/kubernetes-client/python/blob/v21.7.0/kubernetes/docs/CustomObjectsApi.md
config.load_kube_config()
CUSTOM_OBJECT_API = client.CustomObjectsApi()
CORE_API = client.CoreV1Api()

# TODO: config values
NAMESPACE = "orchest"
ORCHEST_CLUSTER_NAME = "cluster-1"


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
    return click.echo(*args, **kwargs)


class CRObjectNotFound(Exception):
    """CR Object defining Orchest Cluster not found."""

    pass


class ClickCommonOptionsCmd(click.Command):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Add the common commands to the beginning of the list so that
        # they are displayed first in the help menu.
        self.params = [
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


@click.group(
    context_settings={
        "help_option_names": ["-h", "--help"],
    }
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
    DEPLOYING_ORCHEST = "Deploying Orchest"
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
    resource = {
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
            body=resource,
        )
    except client.ApiException as e:
        echo("Failed to install Orchest.")
        if e.status == 409:  # conflict
            echo("Orchest is already installed. To update, run:")
            echo("\torchest update")
        else:
            echo("Could not create the required namespaced custom object.")
        sys.exit(1)

    echo("Setting up the Orchest Cluster...", nl=False)

    # NOTE: Watching (using `watch.Watch().stream(...)`) is not
    # supported, thus we go for a loop instead:
    # https://github.com/kubernetes-client/python/issues/1679
    curr_status = ClusterStatus.INITIALIZING
    end_status = ClusterStatus.PENDING
    while curr_status != end_status:
        curr_status = _get_orchest_cluster_status(ns, cluster_name)
        echo(curr_status)
        time.sleep(1)


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

    version = custom_object["spec"]["orchest"]["defaultTag"]

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
    ns = "orchesttt"

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
    non_interactive_password: Optional[str],
    set_token: bool,
    non_interactive_token: Optional[str],
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
    password: Optional[str],
    is_admin: bool,
    token: Optional[str],
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
    client.run_forever(timeout=10)
    if client.returncode != 0:
        raise RuntimeError(client.read_all())


def _get_orchest_cluster_status(ns: str, cluster_name: str) -> Optional[ClusterStatus]:
    """

    Raises:
        CRObjectNotFound: Custom Object could not be found.

    """
    # TODO: The moment the `/status` endpoint is implemented we can
    # switch to `CUSTOM_OBJECT_API.get_namespaced_custom_object_status`
    custom_object = _get_namespaced_custom_object(ns, cluster_name)

    try:
        # TODO: Introduce more granularity later and add `message`
        status = ClusterStatus(custom_object["status"]["state"])
    except KeyError:
        # NOTE: KeyError can get hit due to `"status"` not yet
        # being present in the response:
        # https://github.com/kubernetes-client/python/issues/1772
        return None

    return status


def _get_namespaced_custom_object(ns: str, cluster_name: str) -> Dict:
    """

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
