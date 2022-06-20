"""The Orchest CLI commands.

More on the structure of the CLI can be found in `cli.py`.

All commands here are just interacting (read or write) with the CR
Object defining the Orchest Cluster to trigger actions in the
`orchest-controller` that is watching the CR Object for changes.

"""
import enum
import json
import re
import sys
import time
import typing as t
from functools import partial

import click
import requests
import yaml
from kubernetes import client, config, stream
from orchestcli import utils

# Only when running a type checker, e.g. mypy, would we do the following
# imports. Apart from type checking these imports are not needed.
if t.TYPE_CHECKING:
    from multiprocessing.pool import AsyncResult

try:
    config.load_kube_config()
except config.config_exception.ConfigException:
    config.load_incluster_config()

ORCHEST_NAMESPACE = re.compile("(namespace: )([-a-z]+)")

API_CLIENT = client.ApiClient()
APPS_API = client.AppsV1Api()
CORE_API = client.CoreV1Api()
CUSTOM_OBJECT_API = client.CustomObjectsApi()
EXT_API = client.ApiextensionsV1Api()
RBAC_API = client.RbacAuthorizationV1Api()

get_namespaced_custom_object = partial(
    CUSTOM_OBJECT_API.get_namespaced_custom_object,
    group="orchest.io",
    version="v1alpha1",
    plural="orchestclusters",
)
create_namespaced_custom_object = partial(
    CUSTOM_OBJECT_API.create_namespaced_custom_object,
    group="orchest.io",
    version="v1alpha1",
    plural="orchestclusters",
)
patch_namespaced_custom_object = partial(
    CUSTOM_OBJECT_API.patch_namespaced_custom_object,
    group="orchest.io",
    version="v1alpha1",
    plural="orchestclusters",
)
list_namespaced_custom_object = partial(
    CUSTOM_OBJECT_API.list_namespaced_custom_object,
    group="orchest.io",
    version="v1alpha1",
    plural="orchestclusters",
)
delete_namespaced_custom_object = partial(
    CUSTOM_OBJECT_API.delete_namespaced_custom_object,
    group="orchest.io",
    version="v1alpha1",
    plural="orchestclusters",
)


class LogLevel(str, enum.Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"


def echo(*args, **kwargs) -> None:
    """Wrapped `click.echo`.

    Note:
        Will do nothing in case the current CLI command is invoked with
        the `--json` flag.

    """
    click_ctx = click.get_current_context(silent=True)

    if click_ctx is None:
        return click.echo(*args, **kwargs)

    json_flag = click_ctx.params.get("json_flag")
    if json_flag and json_flag is not None:
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


# NOTE: Schema to be kept in sync with `OrchestClusterPhase` from:
# `services/orchest-controller/pkg/apis/orchest/v1alpha1/types.go`
class ClusterStatus(enum.Enum):
    INITIALIZING = "Initializing"
    DEPLOYINGTHIRDPARTIES = "Deploying Third Parties"
    DEPLOYEDTHIRDPARTIES = "Deployed Third Parties"
    DEPLOYINGORCHEST = "Deploying Orchest Control Plane"
    DEPLOYEDORCHEST = "Deployed Orchest Control Plane"
    RESTARTING = "Restarting"
    STARTING = "Starting"
    RUNNING = "Running"
    STOPPING = "Stopping"
    CLEANUP = "Cleanup"
    STOPPED = "Stopped"
    UPDATING = "Updating"
    ERROR = "Error"
    UNKNOWN = "Unknown"
    UNHEALTHY = "Unhealthy"
    DELETING = "Deleting"


def install(cloud: bool, dev_mode: bool, fqdn: t.Optional[str], **kwargs) -> None:
    """Installs Orchest."""
    ns, cluster_name = kwargs["namespace"], kwargs["cluster_name"]

    try:
        CORE_API.create_namespace(client.V1Namespace(metadata={"name": ns}))
    except client.ApiException as e:
        if e.reason == "Conflict":
            echo(f"Installing into existing namespace: {ns}.")

    echo("Installing the Orchest Controller to manage the Orchest Cluster...")
    if dev_mode:
        # NOTE: orchest-cli commands to be invoked in Orchest directory
        # root for relative path to work.
        with open(
            "services/orchest-controller/deploy/k8s/orchest-controller.yaml"
        ) as f:
            txt_deploy_controller = f.read()
    else:
        version = _fetch_latest_available_version(curr_version=None, is_cloud=cloud)
        if version is None:
            echo(
                "Failed to fetch latest available version. Without the version"
                " the Orchest Controller can't be installed. Please try again"
                " in a short moment.",
                err=True,
            )
            sys.exit(1)
        try:
            txt_deploy_controller = _fetch_orchest_controller_manifests(version)
        except RuntimeError as e:
            echo(f"{e}", err=True)
            sys.exit(1)

    # Makes the namespace configurable.
    txt_deploy_controller = _subst_namespace(subst=ns, string=txt_deploy_controller)

    # Deploy the `orchest-controller` and the resources it needs.
    yml_deploy_controller = yaml.safe_load_all(txt_deploy_controller)
    failed_to_create_k8s_objs = []
    conflicting_k8s_resources = []
    for yml_document in yml_deploy_controller:
        if yml_document is None:
            continue
        try:
            utils.create_from_dict(
                k8s_client=API_CLIENT,
                data=yml_document,
            )
        except utils.FailToCreateError as e:
            for exc in e.api_exceptions:
                if exc.status == 409:  # conflict/already exists
                    conflicting_k8s_resources.append(json.loads(exc.body)["details"])
                elif exc.status == 500:
                    failed_to_create_k8s_objs.append(yml_document)
                else:
                    raise e

    # Don't overwrite existing/conflicting resources, fail instead.
    if conflicting_k8s_resources:
        conflicting_k8s_resources_msg = "\n".join(
            [json.dumps(resource) for resource in conflicting_k8s_resources]
        )

        echo(
            "In case you are trying to install additional 'orchestclusters'"
            " then please note that this is not yet supported. On update the"
            " cluster-level resources of one 'orchestcluster' could become"
            " incompatible with another 'orchestcluster'.",
            err=True,
        )
        echo(
            "Orchest seems to have been installed before and was incorrectly"
            " uninstalled, leaving dangling state. Please ensure you are on"
            " a compatible 'orchest-cli' version and run:\n\torchest uninstall",
            err=True,
        )
        echo(
            "If uninstalling doesn't work, then please try to remove the"
            " following resources manually before installing again:"
            f"\n{conflicting_k8s_resources_msg}",
            err=True,
        )
        sys.exit(1)

    # Retry to create k8s objects that could not be created the first
    # time.
    if failed_to_create_k8s_objs:
        retries = 0
        get_backoff_period = lambda x: 5 * 2**x  # noqa
        # NOTE: Total possible wait of `sum(5 * 2**x for x in range(4))`
        # which is 75s.
        while retries < 4:
            echo(
                "Failed to install the Orchest Controller, retrying in"
                f" {get_backoff_period(retries)} seconds...",
            )
            time.sleep(get_backoff_period(retries))

            tmp_failed_to_create_k8s_objs = []
            for yml_document in failed_to_create_k8s_objs:
                try:
                    # NOTE: Use replace instead of create to handle
                    # "List" kinds.
                    utils.replace_from_dict(
                        k8s_client=API_CLIENT,
                        data=yml_document,
                    )
                except utils.FailToCreateError as e:
                    for exc in e.api_exceptions:
                        if exc.status == 500:
                            tmp_failed_to_create_k8s_objs.append(yml_document)
                            exc_msg = json.loads(exc.body)["message"]
                        else:
                            raise e

            failed_to_create_k8s_objs = tmp_failed_to_create_k8s_objs
            if failed_to_create_k8s_objs:
                retries += 1
            else:
                break
        else:
            echo(
                f"Installation aborted. Kubernetes API message:\n{exc_msg}",
                err=True,
            )
            sys.exit(1)

    custom_object = {
        "apiVersion": "orchest.io/v1alpha1",
        "kind": "OrchestCluster",
        "metadata": {
            "name": cluster_name,
            "namespace": ns,
        },
        "spec": {
            "orchest": {
                "orchestHost": fqdn,
                "orchestWebServer": {"env": [{"name": "CLOUD", "value": str(cloud)}]},
                "authServer": {"env": [{"name": "CLOUD", "value": str(cloud)}]},
            },
        },
    }

    # Once the CR is created, the operator will read it and start
    # setting up the Orchest Cluster.
    try:
        create_namespaced_custom_object(
            namespace=ns,
            body=custom_object,
        )
    except client.ApiException as e:
        if e.status == 409:  # conflict
            echo("Orchest is already installed. To update, run:", err=True)
            echo("\torchest update", err=True)
        else:
            echo("Failed to install Orchest.", err=True)
            echo("Could not create the required namespaced custom object.", err=True)
        sys.exit(1)

    echo("Setting up the Orchest Cluster...", nl=True)
    _display_spinner(ClusterStatus.INITIALIZING, ClusterStatus.RUNNING)
    echo("Successfully installed Orchest!")

    if fqdn is not None:
        echo(
            f"Orchest is running with an FQDN equal to {fqdn}. To access it locally,"
            " add an entry to your '/etc/hosts' file mapping the cluster ip"
            f" (`minikube ip`) to '{fqdn}'. If you are on mac run the `minikube tunnel`"
            f" daemon and map '127.0.0.1' to {fqdn} in the '/etc/hosts' file instead."
            f" You will then be able to reach Orchest at http://{fqdn}."
        )
    else:
        echo(
            "Orchest is running without an FQDN. To access Orchest locally, simply"
            " go to the IP returned by `minikube ip`. If you are on mac run the"
            " `minikube tunnel` daemon and map '127.0.0.1' to `minikube ip` in the"
            " '/etc/hosts' file instead."
        )


def uninstall(**kwargs) -> None:
    """Uninstalls Orchest."""

    def _remove_custom_objects(ns: str) -> None:
        custom_objects = list_namespaced_custom_object(
            namespace=ns,
        )
        for custom_object in custom_objects["items"]:
            delete_namespaced_custom_object(
                namespace=ns,
                name=custom_object["metadata"]["name"],
            )

    ns = kwargs["namespace"]

    echo("Uninstalling Orchest...")

    # Remove all orchest related custom resources in the namespace.
    # Otherwise the namespace can't be removed due to the configured
    # finalizers on the orchestcluster resources.
    echo("Removing all Orchest Clusters...")
    try:
        _remove_custom_objects(ns)
    except client.ApiException as e:
        if e.status == 404:
            echo(f"No Orchest Clusters found to delete in namespace: '{ns}'.", err=True)
        else:
            raise
    else:
        # Wait until the custom objects are removed to ensure a correct
        # removal (which is handled by the `orchest-controller`).
        while True:
            custom_objects = list_namespaced_custom_object(
                namespace=ns,
            )
            if not custom_objects["items"]:
                break

    # Removing the namespace will also remove all resources contained in
    # it.
    echo(f"Removing '{ns}' namespace...")
    delete_issued = False
    while True:
        try:
            if not delete_issued:
                CORE_API.delete_namespace(ns)
                delete_issued = True
            else:
                CORE_API.read_namespace(ns)
        except client.ApiException as e:
            if e.status == 404:
                break
            raise e
        time.sleep(1)

    # Delete cluster level resources.
    echo("Removing Orchest's cluster-level resources...")
    RBAC_API.delete_cluster_role(name="orchest-controller")
    RBAC_API.delete_cluster_role_binding(name="orchest-controller")
    EXT_API.delete_custom_resource_definition(name="orchestclusters.orchest.io")
    EXT_API.delete_custom_resource_definition(name="orchestcomponents.orchest.io")

    echo("\nSuccessfully uninstalled Orchest.")


# NOTE:
# Issues preventing a `kubectl apply` equivalent in Python:
# https://github.com/kubernetes-client/python/pull/959
# https://github.com/kubernetes-client/python/issues/1093#issuecomment-611773280
# That is why we have built similar behavior ourselves. There are some
# other issues when it comes to applying the `orchest-controller.yaml`
# manifest that we can't solve:
# - Deleting resources from the controller.yaml will not be picked up
#   by update.
# - All resources in the `orchest-controller.yaml` must have a name,
#   because it is used to identify the object and search for its
#   existence in the cluster. If not found, a new object is created.
def update(
    version: t.Optional[str],
    watch_flag: bool,
    dev_mode: bool,
    **kwargs,
) -> None:
    """Updates Orchest."""

    def lte(old: str, new: str) -> bool:
        """Returns `old <= new`, i.e. less than or equal.

        In other words, returns whether `new` is a newer version than
        `old`.

        Raises:
            ValueError: If `old` or `new` does not follow our CalVer
                versioning scheme.

        """
        if not _is_calver_version(old):
            raise ValueError(
                f"The given version '{old}' does not follow"
                " CalVer versioning, e.g. 'v2022.02.4'."
            )
        elif not _is_calver_version(new):
            raise ValueError(
                f"The given version '{new}' does not follow"
                " CalVer versioning, e.g. 'v2022.02.4'."
            )

        old, new = old[1:], new[1:]
        for o, n in zip(old.split("."), new.split(".")):
            if int(o) > int(n):
                return False
            elif int(o) < int(n):
                return True
        return True

    ns, cluster_name = kwargs["namespace"], kwargs["cluster_name"]

    tmp_fetching = "version"
    try:
        # NOTE: Important! Getting the cluster version will fail if the
        # update is invoked with a `ns` in which Orchest is not
        # installed. This is exactly what we want.
        curr_version = _get_orchest_cluster_version(ns, cluster_name)
        tmp_fetching = "running mode"
        is_cloud_mode = _is_orchest_in_cloud_mode(ns, cluster_name)

    except CRObjectNotFound as e:
        echo(
            f"Failed to fetch current Orchest Cluster {tmp_fetching} to make"
            " sure the cluster isn't downgraded.",
            err=True,
        )
        echo(e, err=True)
        sys.exit(1)

    except KeyError:
        echo(
            f"Failed to fetch current Orchest Cluster {tmp_fetching} to make"
            " sure the cluster isn't downgraded.",
            err=True,
        )
        echo(
            "Make sure your CLI version is compatible with the running"
            " Orchest Cluster version.",
            err=True,
        )
        sys.exit(1)

    if version is None:
        version = _fetch_latest_available_version(curr_version, is_cloud_mode)
        if version is None:
            echo("Failed to fetch latest available version to update to.", err=True)
            sys.exit(1)
    else:
        # Verify user input.
        if not _is_calver_version(version):
            echo(
                f"The format of the given version '{version}'"
                " is incorrect and can't be updated to.",
                err=True,
            )
            echo("The version should follow CalVer, e.g. 'v2022.02.4'.", err=True)
            sys.exit(1)

    if curr_version == version:
        echo(f"Orchest Cluster is already on version: {version}.")
        sys.exit()
    elif not lte(curr_version, version):
        echo("Aborting update. Downgrading is not supported.", err=True)
        echo(
            f"Orchest Cluster is on version '{curr_version}',"
            f" which is newer than the given version '{version}'.",
            err=True,
        )
        sys.exit(1)

    echo("Updating the Orchest Controller deployment requirements...")
    if dev_mode:
        # NOTE: orchest-cli commands to be invoked in Orchest directory
        # root for relative path to work.
        with open(
            "services/orchest-controller/deploy/k8s/orchest-controller.yaml"
        ) as f:
            txt_deploy_controller = f.read()
    else:
        try:
            txt_deploy_controller = _fetch_orchest_controller_manifests(version)
        except RuntimeError as e:
            echo(f"{e}", err=True)
            sys.exit(1)

    # The namespace to install the controller in should be the same as
    # the namespace in which Orchest is currently installed.
    txt_deploy_controller = _subst_namespace(subst=ns, string=txt_deploy_controller)

    yml_deploy_controller = yaml.safe_load_all(txt_deploy_controller)
    try:
        utils.replace_from_yaml(
            k8s_client=API_CLIENT,
            yaml_objects=yml_deploy_controller,
        )
    except utils.FailToCreateError:
        echo(
            "Failed to update Orchest. Could not apply 'orchest-controller'"
            " manifests.",
            err=True,
        )
        sys.exit(1)

    # Returns an iterator so we need to init it again to get the
    # `namespace` and `labels` of the `orchest-controller` deployment
    # for the next step.
    yml_deploy_controller = yaml.safe_load_all(txt_deploy_controller)
    while True:
        try:
            obj = next(yml_deploy_controller)

            if (
                obj is not None
                and obj["kind"] == "Deployment"
                # NOTE: We need to assume something to not change
                # in the controller deployment to be able to
                # distinguish it from other defined deployments in
                # the yaml file.
                and obj["metadata"]["name"] == "orchest-controller"
            ):
                controller_namespace = obj["metadata"]["namespace"]
                controller_pod_labels = obj["spec"]["selector"]["matchLabels"]
                break
        except StopIteration:
            echo(
                "Aborting update. No deployment manifest is defined for the"
                " 'orchest-controller'.",
                err=True,
            )
            sys.exit(1)

    # Wait until the `orchest-controller` is successfully updated. We
    # don't accidentally want the old `orchest-controller` to initiate
    # the update process.
    # NOTE: use a while instead of watch command because the watch
    # could time out due to us changing labels in versions and thus the
    # watch command not returning anything.
    echo("Updating the Orchest Controller deployment...")
    label_selector = ",".join(
        [f"{key}={value}" for key, value in controller_pod_labels.items()]
    )
    while True:
        resp = CORE_API.list_namespaced_pod(
            namespace=controller_namespace,
            label_selector=label_selector,
        )
        if resp is None or not resp.items:
            time.sleep(1)
            continue

        if len(resp.items) > 1:
            echo(
                "Aborting update. Multiple 'orchest-controller' pods found, whilst"
                "expecting only 1.",
                err=True,
            )
            sys.exit(1)

        controller_pod = resp.items[0]
        for container in controller_pod.spec.containers:
            # NOTE: Assume that the `orchest-controller` deployment
            # only defines Orchest owned images. This way we can
            # infer what the version of the image should be.
            if not container.image.endswith(f":{version}"):
                break
        else:
            if controller_pod.status.phase == "Running":  # type: ignore
                break

        time.sleep(1)

    echo("Updating the Orchest Cluster...")
    try:
        patch_namespaced_custom_object(
            name=cluster_name,
            namespace=ns,
            body={"spec": {"orchest": {"version": version}}},
        )
    except client.ApiException as e:
        echo("Failed to update the Orchest Cluster version.", err=True)
        if e.status == 404:  # not found
            echo(
                f"The Orchest Cluster named '{cluster_name}' in namespace"
                f" '{ns}' could not be found.",
                err=True,
            )
        else:
            echo(f"Reason: {e.reason}", err=True)
        sys.exit(1)

    if watch_flag:
        _display_spinner(ClusterStatus.RUNNING, ClusterStatus.RUNNING)
        echo("Successfully updated Orchest!")


def patch(
    dev: t.Optional[bool],
    cloud: t.Optional[bool],
    log_level: t.Optional[LogLevel],
    **kwargs,
) -> None:
    """Patches the Orchest Cluster."""

    def convert_to_strategic_merge_patch(patch_obj: t.Dict, obj: t.Dict) -> None:
        """Strategically merges list[dict] of `patch_obj` with `obj`.

        `patch_obj` is changed in-place.

        Note:
            It is assumed that all lists inside the given objects are
            lists of dictionaries, i.e. list[dict], and those
            dictionaries are of the format::

                {"name": ..., "value", ...}

        Precedence is given to `patch_obj`, i.e. if a dict["name"] entry
        exists in both the lists of `patch_obj` and `obj` then the
        dict of `patch_obj` is kept.

        Example:
            >>> patch = {
            ...     "key": [{"name": "patch-1", "value": "patch-1"}]
            ... }
            >>> obj = {"key": [{"name": "patch-1", "value": "obj-1"}]}
            >>> convert_to_strategic_merge_patch(patch, obj)
            >>> patch
            ... {"key": [{"name": "patch-1", "value": "patch-1"}]}

        More information on what a strategic merge patch is can be found
        here:
            https://kubernetes.io/docs/tasks/manage-kubernetes-objects/update-api-object-kubectl-patch

        """
        for key, spec in patch_obj.items():
            if key not in obj:
                continue

            if isinstance(spec, dict):
                convert_to_strategic_merge_patch(patch_obj[key], obj[key])
            elif isinstance(spec, list):
                # Strategically merge it.
                patch_items = set(d["name"] for d in spec)
                for obj_item in obj[key]:
                    if obj_item["name"] not in patch_items:
                        spec.append(obj_item)

    def disable_telemetry() -> None:
        command = [
            "curl",
            "-X",
            "PUT",
            "localhost:80/api/ctl/orchest-settings",
            "-H",
            "Content-Type: application/json",
            "-d",
            '{"TELEMETRY_DISABLED": true}',
        ]
        _run_pod_exec(
            ns,
            cluster_name,
            "orchest-api",
            command,
        )

    echo("Patching the Orchest Cluster.")
    ns, cluster_name = kwargs["namespace"], kwargs["cluster_name"]

    if dev is None:
        env_var_dev = None
    elif dev:
        try:
            disable_telemetry()
        except RuntimeError as e:
            echo(e, err=True)
            echo("Failed to disable telemetry. Continuing.", err=True)

        env_var_dev = {"name": "FLASK_ENV", "value": "development"}

        _cmd = (
            "minikube start --memory 16000 --cpus 12 "
            '--mount-string="$(pwd):/orchest-dev-repo" --mount'
        )
        echo(
            "Note that when running in dev mode you need to have mounted the orchest "
            "repository into minikube. For example by running the following when "
            f"creating the cluster, while being in the repo: '{_cmd}'. The behaviour "
            "of mounting in minikube is driver dependant and has some open issues, "
            "so try to stay on the proven path. A cluster created through the "
            "scripts/install_minikube.sh script, for example, would lead to the mount "
            "only working on the master node, due to the kvm driver."
        )
    else:
        env_var_dev = {"name": "FLASK_ENV", "value": "production"}

    if cloud is None:
        env_var_cloud = None
    else:
        env_var_cloud = {"name": "CLOUD", "value": str(cloud)}

    if log_level is None:
        env_var_log_level = None
    else:
        env_var_log_level = {"name": "ORCHEST_LOG_LEVEL", "value": log_level.value}

    # NOTE: The merge strategy of a PATCH will always be replace. It
    # should be possible to define strategic merge on CRDs, but for some
    # reason we didn't get this to work:
    # https://kubernetes.io/docs/reference/using-api/server-side-apply/#custom-resources
    # Therefore, we first GET the custom object, PATCH it at runtime
    # our selves, then send the PATCH request.
    custom_object = _get_namespaced_custom_object(ns, cluster_name)
    orchest_spec_patch = {
        "authServer": {
            "env": [env for env in [env_var_dev, env_var_cloud] if env is not None],
        },
        "orchestWebServer": {
            "env": [env for env in [env_var_dev, env_var_cloud] if env is not None],
        },
        "orchestApi": {
            "env": [env for env in [env_var_dev, env_var_cloud] if env is not None],
        },
        "celeryWorker": {
            "env": [env for env in [env_var_dev] if env is not None],
        },
        "env": [env for env in [env_var_log_level] if env is not None],
    }
    convert_to_strategic_merge_patch(
        orchest_spec_patch,
        custom_object["spec"]["orchest"],  # type: ignore
    )

    try:
        patch_namespaced_custom_object(
            name=cluster_name,
            namespace=ns,
            body={"spec": {"orchest": orchest_spec_patch}},
        )
    except client.ApiException as e:
        echo("Failed to patch the Orchest Cluster.", err=True)
        if e.status == 404:  # not found
            echo(
                f"The Orchest Cluster named '{cluster_name}' in namespace"
                f" '{ns}' could not be found.",
                err=True,
            )
        else:
            echo(f"Reason: {e.reason}", err=True)
        sys.exit(1)

    _display_spinner(ClusterStatus.RUNNING, ClusterStatus.RUNNING)
    echo("Successfully patched the Orchest Cluster.")


def version(json_flag: bool, latest_flag: bool, **kwargs) -> None:
    """Gets Orchest version."""
    try:
        if latest_flag:
            version = _fetch_latest_available_version(curr_version=None, is_cloud=False)
        else:
            version = _get_orchest_cluster_version(
                kwargs["namespace"],
                kwargs["cluster_name"],
            )

    except CRObjectNotFound as e:
        if json_flag:
            jecho({})
        else:
            echo("Failed to fetch Orchest Cluster version.", err=True)
            echo(e, err=True)
        sys.exit(1)

    except KeyError:
        if json_flag:
            jecho({})
        else:
            echo("Failed to fetch Orchest Cluster version.", err=True)
            echo(
                "Make sure your CLI version is compatible with the running"
                " Orchest Cluster version.",
                err=True,
            )
        sys.exit(1)

    if json_flag:
        jecho({"version": version})
    else:
        echo(version)


def status(json_flag: bool, **kwargs) -> None:
    """Gets Orchest Cluster status."""
    ns, cluster_name = kwargs["namespace"], kwargs["cluster_name"]

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


def stop(watch: bool, **kwargs) -> None:
    """Stops Orchest."""
    ns, cluster_name = kwargs["namespace"], kwargs["cluster_name"]

    echo("Stopping the Orchest Cluster.")
    try:
        patch_namespaced_custom_object(
            name=cluster_name,
            namespace=ns,
            body={"spec": {"orchest": {"pause": True}}},
        )
    except client.ApiException as e:
        echo("Failed to stop the Orchest Cluster.", err=True)
        if e.status == 404:  # not found
            echo(
                f"The Orchest Cluster named '{cluster_name}' in namespace"
                f" '{ns}' could not be found.",
                err=True,
            )
        else:
            echo(f"Reason: {e.reason}", err=True)
        sys.exit(1)

    if watch:
        _display_spinner(ClusterStatus.RUNNING, ClusterStatus.STOPPED)
        echo("Successfully stopped Orchest.")


def start(watch: bool, **kwargs) -> None:
    """Starts Orchest."""
    ns, cluster_name = kwargs["namespace"], kwargs["cluster_name"]

    echo("Starting the Orchest Cluster.")
    try:
        patch_namespaced_custom_object(
            name=cluster_name,
            namespace=ns,
            body={"spec": {"orchest": {"pause": False}}},
        )
    except client.ApiException as e:
        echo("Failed to start the Orchest Cluster.", err=True)
        if e.status == 404:  # not found
            echo(
                f"The Orchest Cluster named '{cluster_name}' in namespace"
                f" '{ns}' could not be found.",
                err=True,
            )
        else:
            echo(f"Reason: {e.reason}", err=True)
        sys.exit(1)

    if watch:
        _display_spinner(ClusterStatus.STOPPED, ClusterStatus.RUNNING)
        echo("Successfully started Orchest.")


def restart(watch: bool, **kwargs) -> None:
    """Restarts Orchest."""
    ns, cluster_name = kwargs["namespace"], kwargs["cluster_name"]

    echo("Restarting the Orchest Cluster.")
    try:
        status = _get_orchest_cluster_status(ns, cluster_name)
        if status == ClusterStatus.STOPPED:
            start(**kwargs)
        else:
            status = ClusterStatus.RUNNING
            patch_namespaced_custom_object(
                name=cluster_name,
                namespace=ns,
                # NOTE: strategic merge does work on the annotations in
                # the metadata.
                # `RestartAnnotationKey` in the `orchest-controller`.
                body={"metadata": {"annotations": {"orchest.io/restart": "true"}}},
                # Don't replace the annotations instead merge with
                # existing keys.
                field_manager="StrategicMergePatch",
            )
    except client.ApiException as e:
        echo("Failed to restart the Orchest Cluster.", err=True)
        if e.status == 404:  # not found
            echo(
                f"The Orchest Cluster named '{cluster_name}' in namespace"
                f" '{ns}' could not be found.",
                err=True,
            )
        else:
            echo(f"Reason: {e.reason}", err=True)
        sys.exit(1)

    if watch:
        _display_spinner(status, ClusterStatus.RUNNING)
        echo("Successfully restarted Orchest.")


# Application command.
def adduser(
    username: str,
    is_admin: bool,
    non_interactive: bool,
    non_interactive_password: t.Optional[str],
    set_token: bool,
    non_interactive_token: t.Optional[str],
    **kwargs,
) -> None:
    """Adds a new user to Orchest."""
    ns, cluster_name = kwargs["namespace"], kwargs["cluster_name"]

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

    command = ["python", "add_user.py", username, password]
    if token is not None:
        command.append("--token")
        command.append(token)
    if is_admin:
        command.append("--is_admin")

    _run_pod_exec(
        ns,
        cluster_name,
        "auth-server",
        command,
    )


def _run_pod_exec(
    ns: str,
    cluster_name: str,
    orchest_service: str,
    command: t.List[str],
    check_gate=True,
) -> None:
    """Runs `command` inside the pod defined by `orchest_service`.

    Raises:
        RuntimeError: If something went wrong when trying to run the
            command in the pod, or when the command did not return with
            a zero exit code.

    """

    def passes_gate(ns: str, cluster_name: str) -> t.Tuple[bool, str]:
        """Returns whether the Orchest Cluster is in a valid state.

        Returns:
            True, "": if Cluster is in a valid state.
            False, reason: if Cluster is in an invalid state.

        """
        try:
            status = _get_orchest_cluster_status(ns, cluster_name)
        except CRObjectNotFound as e:
            return False, str(e)

        if status != ClusterStatus.RUNNING:
            reason = (
                "The Orchest Cluster state is "
                " '{'unknown' if status is None else status.value}', whereas it needs"
                " to be '{ClusterStatus.RUNNING.value}'. Check:"
                "\n\torchest status"
            )
            return False, reason

        return True, ""

    if check_gate:
        passed_gate, reason = passes_gate(ns, cluster_name)
        if not passed_gate:
            raise RuntimeError(f"Failed to pass gate: {reason}")

    pods = CORE_API.list_namespaced_pod(
        ns,
        label_selector=(
            f"controller.orchest.io/component={orchest_service},"
            "controller.orchest.io/part-of=orchest,"
            f"controller.orchest.io/owner={orchest_service}"
        ),
    )
    if not pods.items:
        raise RuntimeError(
            f"Orchest Cluster is in an invalid state: no '{orchest_service}' found."
        )
    elif len(pods.items) > 1:
        raise RuntimeError(
            "Orchest Cluster is in an invalid state: multiple "
            f" '{orchest_service}' found."
        )
    else:
        pod = pods.items[0]

    client = stream.stream(
        CORE_API.connect_get_namespaced_pod_exec,
        name=pod.metadata.name,
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
    # WS connection open indefinitely if something goes wrong when
    # running the command.
    client.run_forever(timeout=20)
    if client.returncode != 0:
        raise RuntimeError(client.read_all())


def _get_orchest_cluster_status(
    ns: str, cluster_name: str
) -> t.Optional[ClusterStatus]:
    """Gets Orchest Cluster status.

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
        custom_object = get_namespaced_custom_object(
            name=cluster_name,
            namespace=ns,
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


def _display_spinner(
    curr_status: ClusterStatus,
    end_status: ClusterStatus,
    file: t.Optional[t.IO] = None,
) -> None:
    """Displays a spinner until the end status is reached.

    The spinner is displayed in `file` which defaults to `STDOUT`.

    Note:
        The spinner is not "fool-proof" when running quick succinct
        CLI commands.

        For example: running <--> updating. Then when the cluster
        status is "updating", one can't infer whether that was due to
        the current invoked command or the next command. Thus the
        spinner can't know whether it should stop displaying.

        The spinner is displayed based on the cluster status, which is
        just one moment in time: the moment the request is returned.
        Based on the ping of a user and the speed with which the
        `orchest-controller` changes the status of the cluster, we can't
        infer whether the `end_status` has already been reached.

        The implementation assumes the `end_status` is reached
        eventually and no concurrent/quick successive commands are
        issued.

    """

    def echo(*args, **kwargs):
        """Local echo function.

        Inside the function one can now call the regular `echo` instead
        of always having to call `echo(..., file=file)`.

        """
        global echo
        nonlocal file

        if file is None:
            file = sys.stdout

        if kwargs.get("file") is None:
            return echo(*args, file=file, **kwargs)
        else:
            return echo(*args, **kwargs)

    # Get the required arguments to get the status of the custom object
    # from the click context.
    # If the assertion fails, try adding `watch=False` to the command
    # as to not to display a spinner.
    click_ctx = click.get_current_context(silent=True)
    assert click_ctx is not None, "Can only display spinner through CLI invocation."

    ns = t.cast(str, click_ctx.params.get("namespace"))
    cluster_name = t.cast(str, click_ctx.params.get("cluster_name"))

    # NOTE: Assumes the `orchest-controller` changes the status of the
    # Orchest Cluster based on the management command within 10s and the
    # initial request getting the cluster status succeeding within that
    # time as well. Meaning that the passed `curr_status` is actually no
    # longer the actual status of the Cluster. Allowing the passed
    # `curr_status` to equal the `end_status` (without requiring double
    # invocation of this function, which would lead to other issues).
    invocation_time = time.time()

    try:
        # NOTE: Click's `echo` makes sure the ANSI characters work
        # cross-platform. For Windows it uses `colorama` to do so.
        echo("\033[?25l", nl=False)  # hide cursor

        # NOTE: Watching (using `watch.Watch().stream(...)`) is not
        # supported, thus we go for a loop instead:
        # https://github.com/kubernetes-client/python/issues/1679
        prev_status = curr_status

        # Use `async_req` to make sure spinner is always loading.
        thread = _get_namespaced_custom_object(ns, cluster_name, async_req=True)
        while curr_status != end_status or (time.time() - invocation_time < 10):
            thread = t.cast("AsyncResult", thread)
            if thread.ready():
                try:
                    resp = thread.get()
                except client.ApiException as e:
                    echo(err=True)  # newline
                    echo(f"🙅 Failed to {click_ctx.command.name}.", err=True)
                    if e.status == 404:  # not found
                        echo(
                            "The CR Object defining the Orchest Cluster was removed"
                            " by an external process during installation.",
                            err=True,
                        )
                        sys.exit(1)
                    else:
                        raise

                curr_status = _parse_cluster_status_from_custom_object(
                    resp,
                )  # type: ignore
                thread = _get_namespaced_custom_object(ns, cluster_name, async_req=True)

            if curr_status is None:
                curr_status = prev_status

            if curr_status == prev_status:
                for _ in range(3):
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

                # Otherwise we would wait without reason once the
                # command has finished.
                if curr_status != end_status:
                    thread.wait()  # type: ignore
    finally:
        echo("\033[?25h", nl=True)  # show cursor


def _get_orchest_cluster_version(ns: str, cluster_name: str) -> str:
    """Gets the current version of the Orchest Cluster.

    Raises:
        CRObjectNotFound: If the Orchest Cluster CR Object couldn't be
            found.
        KeyError: If the `version` entry couldn't be accessed from the
            CR Object.

    """
    custom_object = _get_namespaced_custom_object(ns, cluster_name)
    return custom_object["spec"]["orchest"]["version"]  # type: ignore


def _is_orchest_in_cloud_mode(ns: str, cluster_name: str) -> bool:
    """Answers whether Orchest is running in cloud mode or not.

    Raises:
        CRObjectNotFound: If the Orchest Cluster CR Object couldn't
            be found.
        KeyError: If the returned custom object has an unexpected
            format.

    """
    custom_object = _get_namespaced_custom_object(ns, cluster_name)
    env = custom_object["spec"]["orchest"]["orchestWebServer"]["env"]  # type: ignore
    for env_var in env:
        if env_var["name"] == "CLOUD":
            if env_var["value"] in ["True", "TRUE", "true"]:
                return True
    return False


def _is_calver_version(version: str) -> bool:
    try:
        year, month, patch = version.split(".")
        if (
            not year.startswith("v")
            or len(year) != 5
            or len(month) != 2
            or len(patch) == 0
        ):
            raise

        int(year[1:]), int(month), int(patch)
    except Exception:
        return False

    return True


def _fetch_latest_available_version(
    curr_version: t.Optional[str], is_cloud: bool
) -> t.Optional[str]:
    url = (
        "https://update-info.orchest.io/api/orchest/"
        f"update-info/v3?version={curr_version}&is_cloud={is_cloud}"
    )
    resp = requests.get(url, timeout=5)

    if resp.status_code == 200:
        data = resp.json()
        return data["latest_version"]
    else:
        return None


def _fetch_orchest_controller_manifests(version: t.Optional[str]) -> str:
    url = (
        "https://github.com/orchest/orchest"
        f"/releases/download/{version}/orchest-controller.yaml"
    )
    resp = requests.get(url, timeout=10)
    if resp.status_code != 200:
        raise RuntimeError(
            f"Failed to fetch 'orchest-controller' manifest at:\n{url}"
            "\nPlease try again in a short moment."
        )
    else:
        txt_deploy_controller = resp.text

    return txt_deploy_controller


def _subst_namespace(subst: str, string: str) -> str:
    """Substitutes `namespace: [a-z]+` with `subst` in `string`."""
    return ORCHEST_NAMESPACE.sub(rf"\1{subst}", string)
