"""The Orchest CLI.

Architecture:
    CLI -- r/w --> CR Object <-- r/w -- Controller
    where the CLI lives outside of the Kubernetes cluster and the CR
    Object and the Controller live inside the Kubernetes cluster.

    As a common practice, only the controller is writing to the status
    section of the CR Object as to inform the status of the Orchest
    Cluster it is managing. This status will be used to gate application
    commands as to not issue those commands when the cluster is in an
    invalid state.

    Management commands (commands that change the cluster state):
    * Design goal: Users should be able to use tools like `kubectl` for
      all functionality of management commands. The CLI serves as a
      convenience wrapper for common operations.
    * Writes: Users should be able to do these by changing the CR
      directly themselves. The CLI is just a convenience wrapper here.
    * Reads: Done by reading the CR object. For example, version is just
      an entry in the object that users can read directly or can the CLI
      for to do it for them.

    Application commands (commands that interact with the Orchest
    application directly, e.g. `adduser`):
    * Design goal: Can be thought of as `pod exec` commands, given that
      that interacts with Orchest at the application level.
    * Writes: Done through CLI only as it includes application specific
      logic
        * Caveat: CLI needs to be kept in sync with the Orchest
          application itself. For example when updating Orchest it may
          very well be that the new CLI is not compatible (we should try
          to ensure backwards compatibility) or simply can not do
          certain application level commands (e.g. adduser being added
          in a new version that the CLI does not yet support). Users
          need to update the CLI accordingly themselves.
    * Reads: We don't have such functionality yet, but likely only
      possible through CLI. For example, listing all users in the
      auth-server .

Implementation details:
    The CLI commands are defined in this module, whereas the actual body
    of those commands live in separate modules. The reason being is that
    due to the decorator usage for `click`, the commands can't be
    invoked directly as if they were functions. Since we want to invoke
    CLI commands through Python directly (instead of only invoking them
    in a CLI manner), the CLI commands are separated from the actual
    logic.

"""

import collections
import typing as t
from gettext import gettext

import click
from orchestcli import cmds

NAMESPACE = "orchest"
ORCHEST_CLUSTER_NAME = "cluster-1"
ORCHEST_CONTROLLER_DEPLOY_NAME = "orchest-controller"
ORCHEST_CONTROLLER_POD_LABEL_SELECTOR = "app=orchest-controller"
# Application commands are displayed separately from management commands
# in the help menu.
APPLICATION_CMDS = ["adduser"]


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


# Largely a copy-paste from the original source code, but extended to
# display separated categories in the help menu.
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

                # NOTE: Instead we could make it into a separate click
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


@click.option(
    "--cloud",
    is_flag=True,
    default=False,
    show_default=True,
    hidden=True,
    help="Run in cloud mode after install.",
)
@click.option(
    "--fqdn",
    default=None,
    show_default=True,
    help="Fully Qualified Domain Name that Orchest listens on.",
)
@cli.command(cls=ClickCommonOptionsCmd)
def install(cloud: bool, fqdn: t.Optional[str], **common_options) -> None:
    """Install Orchest."""
    cmds.install(cloud, fqdn, **common_options)


# TODO: Should be improved to remove the provided Orchest Cluster,
# then the `orchest-controller` to remove the Cluster resources.
@cli.command(cls=ClickCommonOptionsCmd)
def uninstall(**common_options) -> None:
    """Uninstall Orchest.

    Uninstalls Orchest by removing the provided namespace.
    """
    cmds.uninstall(**common_options)


@click.option(
    "--version",
    default=None,
    show_default=True,
    help="Version to update the Orchest Cluster to.",
)
@click.option(
    "--controller-deploy-name",
    default=ORCHEST_CONTROLLER_DEPLOY_NAME,
    show_default=True,
    help="Deployment name of the controller managing the Orchest Cluster.",
)
@click.option(
    "--controller-pod-label-selector",
    default=ORCHEST_CONTROLLER_POD_LABEL_SELECTOR,
    show_default=True,
    help="Label selector of the controller pod managing the Orchest Cluster.",
)
@click.option(
    "--watch/--no-watch",
    "watch_flag",  # name for arg
    is_flag=True,
    default=True,
    show_default=True,
    help="Watch cluster status changes.",
)
@cli.command(cls=ClickCommonOptionsCmd)
def update(
    version: t.Optional[str],
    controller_deploy_name: str,
    controller_pod_label_selector: str,
    watch_flag: bool,
    **common_options,
) -> None:
    """Update Orchest.

    If `--version` is not given, then it tries to update Orchest to the
    latest version.

    \b
    Note:
        The operation fails if the Orchest Cluster would be downgraded.

    \b
    Usage:
        orchest update

    """
    cmds.update(
        version,
        controller_deploy_name,
        controller_pod_label_selector,
        watch_flag,
        **common_options,
    )


@cli.command(cls=ClickCommonOptionsCmd)
@click.option(
    "--dev/--no-dev",
    is_flag=True,
    default=None,
    show_default=True,
    help="Run in development mode.",
)
@click.option(
    "--cloud/--no-cloud",
    is_flag=True,
    default=None,
    show_default=True,
    hidden=True,
    help="Run in cloud mode.",
)
@click.option(
    "--log-level",
    default=None,
    show_default=True,
    type=click.Choice(cmds.LogLevel),
    help="Log level to set on Orchest services.",
)
def patch(
    dev: t.Optional[bool],
    cloud: t.Optional[bool],
    log_level: t.Optional[cmds.LogLevel],
    **common_options,
) -> None:
    """Patch the Orchest Cluster.

    \b
    Usage:
        # Run Orchest in development mode.
        orchest patch --dev

    """
    cmds.patch(dev, cloud, log_level, **common_options)


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
        kubectl -n <namespace> get orchestclusters <cluster-name> -o jsonpath="{.spec.orchest.version}"

    """
    cmds.version(json_flag, **common_options)


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
    cmds.status(json_flag, **common_options)


@cli.command(cls=ClickCommonOptionsCmd)
@click.option(
    "--watch/--no-watch",
    "watch",  # name for arg
    is_flag=True,
    default=True,
    show_default=True,
    help="Watch status changes.",
)
def stop(watch: bool, **common_options) -> None:
    """Stop Orchest.

    All underlying Orchest deployments will scaled to zero replicas.

    \b
    Equivalent `kubectl` command:
        kubectl -n orchest patch orchestclusters cluster-1 --type='merge' -p='{"spec": {"orchest": {"pause": true}}}'
    """
    cmds.stop(watch, **common_options)


@cli.command(cls=ClickCommonOptionsCmd)
@click.option(
    "--watch/--no-watch",
    "watch",  # name for arg
    is_flag=True,
    default=True,
    show_default=True,
    help="Watch status changes.",
)
def start(watch: bool, **common_options) -> None:
    """Start Orchest.

    \b
    Equivalent `kubectl` command:
        kubectl -n orchest patch orchestclusters cluster-1 --type='merge' -p='{"spec": {"orchest": {"pause": false}}}'
    """
    cmds.start(watch, **common_options)


@cli.command(cls=ClickCommonOptionsCmd)
@click.option(
    "--watch/--no-watch",
    "watch",  # name for arg
    is_flag=True,
    default=True,
    show_default=True,
    help="Watch status changes.",
)
def restart(watch: bool, **common_options) -> None:
    """Restart Orchest.

    Useful to reinitialize the Orchest application for config changes to
    take effect.

    \b
    Equivalent `kubectl` command:
        kubectl -n orchest patch orchestclusters cluster-1 --type='merge' \\
        \t-p='{"metadata": {"annotations": {"orchest.io/restart": "true"}}}'

    """
    cmds.restart(watch, **common_options)


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
    cmds.adduser(
        username,
        is_admin,
        non_interactive,
        non_interactive_password,
        set_token,
        non_interactive_token,
        **common_options,
    )
