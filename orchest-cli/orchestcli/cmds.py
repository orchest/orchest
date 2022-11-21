"""The Orchest CLI commands.

More on the structure of the CLI can be found in `cli.py`.

All commands here are just interacting (read or write) with the CR
Object defining the Orchest Cluster to trigger actions in the
`orchest-controller` that is watching the CR Object for changes.

The commands are implemented as methods of a class so that this package
can be (re)used as a way to programmatically control one or multiple
Orchest clusters.

"""
from __future__ import annotations

import enum
import json
import os
import platform
import re
import sys
import time
import typing as t
from functools import partial

import click
import requests
import yaml
from kubernetes import client, config, stream
from kubernetes.client.api_client import ApiClient
from kubernetes.client.configuration import Configuration
from orchestcli import utils
from urllib3.util.retry import Retry

# Only when running a type checker, e.g. mypy, would we do the following
# imports. Apart from type checking these imports are not needed.
if t.TYPE_CHECKING:
    from multiprocessing.pool import AsyncResult

sys.stdout.reconfigure(encoding="utf-8")


ORCHEST_NAMESPACE = re.compile("(namespace: )([-a-z]+)")


def _get_k8s_api_client(configuration: Configuration) -> ApiClient:
    # Keep in sync with the one in
    # services/orchest-api/app/app/connections.py.
    _retry_strategy = Retry(
        total=5,
        backoff_factor=1,
    )
    # See urllib3 poolmanager.py usage of "retries".
    configuration.retries = _retry_strategy
    return ApiClient(configuration=configuration)


class LogLevel(str, enum.Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"


class CRObjectNotFound(Exception):
    """CR Object defining Orchest Cluster not found."""

    pass


# NOTE: Schema to be kept in sync with `OrchestClusterPhase` from:
# `services/orchest-controller/pkg/apis/orchest/v1alpha1/types.go`
class ClusterStatus(str, enum.Enum):
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

    # Added by CLI to indicate that we are fetching the ClusterStatus.
    FETCHING = "Fetching Orchest Cluster status"


class OrchestCmds:
    def __init__(self, configuration: t.Optional[Configuration] = None):

        if configuration is None:
            try:
                try:
                    config.load_kube_config()
                except config.config_exception.ConfigException:
                    config.load_incluster_config()
            except Exception as e:
                utils.echo(
                    "Aborting..."
                    f"\nCould not load kube-config file: {e}"
                    "\nFor example for minikube, you need to make sure your cluster"
                    " is started.",
                    err=True,
                )
                raise e
            configuration = Configuration.get_default_copy()

        self._setup_k8s_api_clients(configuration)
        self._setup_partial_functions()

    def _setup_k8s_api_clients(self, configuration: Configuration):
        self.API_CLIENT = _get_k8s_api_client(configuration)
        self.APPS_API = client.AppsV1Api(api_client=_get_k8s_api_client(configuration))
        self.CORE_API = client.CoreV1Api(api_client=_get_k8s_api_client(configuration))
        self.CUSTOM_OBJECT_API = client.CustomObjectsApi(
            api_client=_get_k8s_api_client(configuration)
        )
        self.EXT_API = client.ApiextensionsV1Api(
            api_client=_get_k8s_api_client(configuration)
        )
        self.RBAC_API = client.RbacAuthorizationV1Api(
            api_client=_get_k8s_api_client(configuration)
        )

    def _setup_partial_functions(self):
        self.get_namespaced_custom_object = partial(
            self.CUSTOM_OBJECT_API.get_namespaced_custom_object,
            group="orchest.io",
            version="v1alpha1",
            plural="orchestclusters",
        )
        self.create_namespaced_custom_object = partial(
            self.CUSTOM_OBJECT_API.create_namespaced_custom_object,
            group="orchest.io",
            version="v1alpha1",
            plural="orchestclusters",
        )
        self.patch_namespaced_custom_object = partial(
            self.CUSTOM_OBJECT_API.patch_namespaced_custom_object,
            group="orchest.io",
            version="v1alpha1",
            plural="orchestclusters",
        )
        self.list_namespaced_custom_object = partial(
            self.CUSTOM_OBJECT_API.list_namespaced_custom_object,
            group="orchest.io",
            version="v1alpha1",
            plural="orchestclusters",
        )
        self.delete_namespaced_custom_object = partial(
            self.CUSTOM_OBJECT_API.delete_namespaced_custom_object,
            group="orchest.io",
            version="v1alpha1",
            plural="orchestclusters",
        )

    def install(
        self,
        multi_node: bool,
        cloud: bool,
        dev_mode: bool,
        no_argo: bool,
        no_nginx: bool,
        fqdn: t.Optional[str],
        socket_path: t.Optional[str],
        userdir_pvc_size: int,
        registry_pvc_size: int,
        **kwargs,
    ) -> None:
        """Installs Orchest."""
        ns, cluster_name = kwargs["namespace"], kwargs["cluster_name"]

        try:
            self.CORE_API.create_namespace(client.V1Namespace(metadata={"name": ns}))
        except client.ApiException as e:
            if e.reason == "Conflict":
                utils.echo(f"Installing into existing namespace: {ns}.")

        manifest_file_name = "orchest-controller.yaml"

        utils.echo("Installing the Orchest Controller to manage the Orchest Cluster...")
        if dev_mode:
            # NOTE: orchest-cli commands to be invoked in Orchest
            # directory root for relative path to work.
            with open(
                f"services/orchest-controller/deploy/k8s/{manifest_file_name}"
            ) as f:
                txt_deploy_controller = f.read()
        else:
            version = _fetch_latest_available_version(curr_version=None, is_cloud=cloud)
            if version is None:
                utils.echo(
                    "Failed to fetch latest available version. Without the version"
                    " the Orchest Controller can't be installed. Please try again"
                    " in a short moment.",
                    err=True,
                )
                raise RuntimeError()
            try:
                txt_deploy_controller = _fetch_orchest_controller_manifests(
                    version, manifest_file_name
                )
            except RuntimeError as e:
                utils.echo(f"{e}", err=True)
                raise e

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
                    k8s_client=self.API_CLIENT,
                    data=yml_document,
                )
            except utils.FailToCreateError as e:
                for exc in e.api_exceptions:
                    if exc.status == 409:  # conflict/already exists
                        conflicting_k8s_resources.append(
                            json.loads(exc.body)["details"]
                        )
                    elif exc.status == 500:
                        failed_to_create_k8s_objs.append(yml_document)
                    else:
                        raise e

        # Don't overwrite existing/conflicting resources, fail instead.
        if conflicting_k8s_resources:
            conflicting_k8s_resources_msg = "\n".join(
                [json.dumps(resource) for resource in conflicting_k8s_resources]
            )

            utils.echo(
                "In case you are trying to install additional 'orchestclusters'"
                " then please note that this is not yet supported. On update the"
                " cluster-level resources of one 'orchestcluster' could become"
                " incompatible with another 'orchestcluster'.",
                err=True,
            )
            utils.echo(
                "Orchest seems to have been installed before and was incorrectly"
                " uninstalled, leaving dangling state. Please ensure you are on"
                " a compatible 'orchest-cli' version and run:\n\torchest uninstall",
                err=True,
            )
            utils.echo(
                "If uninstalling doesn't work, then please try to remove the"
                " following resources manually before installing again:"
                f"\n{conflicting_k8s_resources_msg}",
                err=True,
            )
            raise RuntimeError()

        # Retry to create k8s objects that could not be created the
        # first time.
        if failed_to_create_k8s_objs:
            retries = 0
            get_backoff_period = lambda x: 5 * 2**x  # noqa
            # NOTE: Total possible wait of `sum(5 * 2**x for x in
            # range(4))` which is 75s.
            while retries < 4:
                utils.echo(
                    "Cannot install the Orchest Controller yet, retrying in"
                    f" {get_backoff_period(retries)} seconds...",
                )
                time.sleep(get_backoff_period(retries))

                tmp_failed_to_create_k8s_objs = []
                for yml_document in failed_to_create_k8s_objs:
                    try:
                        # NOTE: Use replace instead of create to handle
                        # "List" kinds.
                        utils.replace_from_dict(
                            k8s_client=self.API_CLIENT,
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
                utils.echo(
                    f"Installation aborted. Kubernetes API message:\n{exc_msg}",
                    err=True,
                )
                raise RuntimeError()

        # Creating the OrchestCluster custom resource.
        metadata = {
            "name": cluster_name,
            "namespace": ns,
            "annotations": {},
        }
        if socket_path is not None:
            metadata["annotations"]["orchest.io/container-runtime-socket"] = socket_path

        if no_nginx:
            utils.echo(
                "Disabling 'Nginx Ingress Controller' installation."
                "\n\tMake sure 'Nginx Ingress Controller' is already installed "
                "in your cluster"
            )
            metadata["annotations"]["controller.orchest.io/deploy-ingress"] = "false"

        applications = [
            {
                "name": "docker-registry",
                "config": {
                    "helm": {
                        "parameters": [
                            {
                                "name": "persistence.size",
                                "value": f"{registry_pvc_size}Gi",
                            }
                        ]
                    }
                },
            }
        ]
        if no_argo:
            utils.echo(
                "Disabling 'Argo Workflows' installation."
                "\n\tMake sure 'Argo Workflows' is already installed in your cluster"
                "\n\tand has the right permissions set in order to work properly"
                "\n\twith Orchest."
            )
        else:
            applications.append(
                {
                    "name": "argo-workflow",
                    "config": {
                        "helm": {
                            # `singleNamespace` so that Argo acts as a
                            # namespace level component and only
                            # schedule workflows in it's own namespace.
                            "parameters": [{"name": "singleNamespace", "value": "true"}]
                        }
                    },
                }
            )

        spec = {
            "applications": applications,
            "orchest": {
                "orchestHost": fqdn,
                "orchestWebServer": {"env": [{"name": "CLOUD", "value": str(cloud)}]},
                "authServer": {"env": [{"name": "CLOUD", "value": str(cloud)}]},
                "resources": {
                    "userDirVolumeSize": f"{userdir_pvc_size}Gi",
                },
            },
        }

        if multi_node:
            spec["singleNode"] = False

        custom_object = {
            "apiVersion": "orchest.io/v1alpha1",
            "kind": "OrchestCluster",
            "metadata": metadata,
            "spec": spec,
        }

        # Once the CR is created, the operator will read it and start
        # setting up the Orchest Cluster.
        try:
            self.create_namespaced_custom_object(
                namespace=ns,
                body=custom_object,
            )
        except client.ApiException as e:
            if e.status == 409:  # conflict
                utils.echo("Orchest is already installed. To update, run:", err=True)
                utils.echo("\torchest update", err=True)
            else:
                utils.echo("Failed to install Orchest.", err=True)
                utils.echo(
                    "Could not create the required namespaced custom object.", err=True
                )
            raise e

        utils.echo("Setting up the Orchest Cluster...", nl=True)
        self._wait_for_cluster_status(
            ns,
            cluster_name,
            ClusterStatus.INITIALIZING,
            ClusterStatus.RUNNING,
        )

        # Print some final help messages depending on k8s distro.
        try:
            curr_co = self._get_namespaced_custom_object(ns, cluster_name)
            k8s_distro = curr_co["metadata"]["annotations"].get(
                "controller.orchest.io/k8s"
            )
        except Exception:
            k8s_distro = None

        # NOTE: minikube is our primary installation target and thus is
        # the only case we explicitly print the extensive help messages
        # for.
        if k8s_distro is None or k8s_distro != "minikube":
            utils.echo("🚀 Done! Orchest is up!\n")
            if k8s_distro is None:
                utils.echo("To learn how to reach Orchest, please refer to:")
            else:
                utils.echo(
                    f"To learn how to reach Orchest on {k8s_distro}, please refer to:"
                )
            utils.echo(
                "\thttps://docs.orchest.io/en/stable/getting_started/installation.html"
            )
            return

        if fqdn is not None:
            utils.echo(f"🚀 Done! Orchest is up with FQDN: {fqdn}\n")

            if platform.system() == "Darwin":
                utils.echo(
                    "💻 To access it locally, run `sudo minikube tunnel` "
                    f"and map 127.0.0.1 to {fqdn} in your hosts file:"
                )
                utils.echo()
                utils.echo(f'  echo "127.0.0.1 {fqdn}" | sudo tee -a /etc/hosts')
            else:
                utils.echo(
                    "💻 To access it locally, "
                    f"map `minikube ip` to {fqdn} in your hosts file:"
                )
                utils.echo()
                utils.echo(f'  echo "$(minikube ip) {fqdn}" | sudo tee -a /etc/hosts')

            utils.echo()
            utils.echo(f"Once done, you can open http://{fqdn} in your browser.")
        else:
            utils.echo("🚀 Done! Orchest is up!\n")

            if platform.system() == "Darwin":
                utils.echo(
                    "💻 To access it locally, "
                    "run `sudo minikube tunnel` and browse to http://localhost"
                )
            else:
                utils.echo(
                    "💻 To access it locally, "
                    "browse to the IP address returned by `minikube ip`"
                )

    def uninstall(self, **kwargs) -> None:
        """Uninstalls Orchest."""

        def _remove_custom_objects(ns: str) -> None:
            custom_objects = self.list_namespaced_custom_object(
                namespace=ns,
            )
            for custom_object in custom_objects["items"]:
                self.delete_namespaced_custom_object(
                    namespace=ns,
                    name=custom_object["metadata"]["name"],
                )

        ns = kwargs["namespace"]

        utils.echo("Uninstalling Orchest...")

        # Remove all orchest related custom resources in the namespace.
        # Otherwise the namespace can't be removed due to the configured
        # finalizers on the orchestcluster resources.
        utils.echo("Removing all Orchest Clusters...")
        try:
            _remove_custom_objects(ns)
        except client.ApiException as e:
            if e.status == 404:
                utils.echo(
                    f"No Orchest Clusters found to delete in namespace: '{ns}'.",
                    err=True,
                )
            else:
                raise
        else:
            # Wait until the custom objects are removed to ensure a
            # correct removal (which is handled by the
            # `orchest-controller`).
            while True:
                custom_objects = self.list_namespaced_custom_object(
                    namespace=ns,
                )
                if not custom_objects["items"]:
                    break

        # Removing the namespace will also remove all resources
        # contained in it.
        utils.echo(f"Removing '{ns}' namespace...")
        delete_issued = False
        while True:
            try:
                if not delete_issued:
                    self.CORE_API.delete_namespace(ns)
                    delete_issued = True
                else:
                    self.CORE_API.read_namespace(ns)
            except client.ApiException as e:
                if e.status == 404:
                    break
                raise e
            time.sleep(1)

        # Delete cluster level resources.
        utils.echo("Removing Orchest's cluster-level resources...")
        funcs = [
            [self.RBAC_API.delete_cluster_role, ("orchest-controller",)],
            [self.RBAC_API.delete_cluster_role_binding, ("orchest-controller",)],
            [
                self.EXT_API.delete_custom_resource_definition,
                ("orchestclusters.orchest.io",),
            ],
            [
                self.EXT_API.delete_custom_resource_definition,
                ("orchestcomponents.orchest.io",),
            ],
        ]
        for f, args in funcs:
            try:
                f(*args)
            except client.ApiException:
                pass

        utils.echo("\nSuccessfully uninstalled Orchest.")

    # NOTE:
    # Issues preventing a `kubectl apply` equivalent in Python:
    # https://github.com/kubernetes-client/python/pull/959
    # https://github.com/kubernetes-client/python/issues/1093#issuecomment-611773280
    # That is why we have built similar behavior ourselves. There are
    # some other issues when it comes to applying the
    # `orchest-controller.yaml` manifest that we can't solve:
    # - Deleting resources from the controller.yaml will not be picked
    #   up by update.
    # - All resources in the `orchest-controller.yaml` must have a name,
    #   because it is used to identify the object and search for its
    #   existence in the cluster. If not found, a new object is created.
    def update(
        self,
        version: t.Optional[str],
        watch_flag: bool,
        dev_mode: bool,
        **kwargs,
    ) -> None:
        """Updates Orchest."""

        def lte(old: str, new: str) -> bool:
            """Returns `old <= new`, i.e. less than or equal.

            In other words, returns whether `new` is a newer version
            than `old`.

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
            # NOTE: Important! Getting the cluster version will fail if
            # the update is invoked with a `ns` in which Orchest is not
            # installed. This is exactly what we want.
            curr_version = self._get_orchest_cluster_version(ns, cluster_name)
            tmp_fetching = "running mode"
            is_cloud_mode = self._is_orchest_in_cloud_mode(ns, cluster_name)

        except CRObjectNotFound as e:
            utils.echo(
                f"Failed to fetch current Orchest Cluster {tmp_fetching} to make"
                " sure the cluster isn't downgraded.",
                err=True,
            )
            utils.echo(e, err=True)
            raise e

        except KeyError as e:
            utils.echo(
                f"Failed to fetch current Orchest Cluster {tmp_fetching} to make"
                " sure the cluster isn't downgraded.",
                err=True,
            )
            utils.echo(
                "Make sure your CLI version is compatible with the running"
                " Orchest Cluster version.",
                err=True,
            )
            raise e

        if version is None:
            version = _fetch_latest_available_version(curr_version, is_cloud_mode)
            if version is None:
                utils.echo(
                    "Failed to fetch latest available version to update to.", err=True
                )
                raise RuntimeError()
        else:
            # Verify user input.
            if not _is_calver_version(version):
                utils.echo(
                    f"The format of the given version '{version}'"
                    " is incorrect and can't be updated to.",
                    err=True,
                )
                utils.echo(
                    "The version should follow CalVer, e.g. 'v2022.02.4'.", err=True
                )
                raise RuntimeError()

        if curr_version == version:
            utils.echo(f"Orchest Cluster is already on version: {version}.")
            return
        elif not lte(curr_version, version):
            utils.echo("Aborting update. Downgrading is not supported.", err=True)
            utils.echo(
                f"Orchest Cluster is on version '{curr_version}',"
                f" which is newer than the given version '{version}'.",
                err=True,
            )
            raise RuntimeError()

        manifest_file_name = "orchest-controller.yaml"

        utils.echo("Updating the Orchest Controller deployment requirements...")
        if dev_mode:
            # NOTE: orchest-cli commands to be invoked in Orchest
            # directory root for relative path to work.
            with open(
                f"services/orchest-controller/deploy/k8s/{manifest_file_name}"
            ) as f:
                txt_deploy_controller = f.read()
        else:
            try:
                txt_deploy_controller = _fetch_orchest_controller_manifests(
                    version, manifest_file_name
                )
            except RuntimeError as e:
                utils.echo(f"{e}", err=True)
                raise e

        # The namespace to install the controller in should be the same
        # as the namespace in which Orchest is currently installed.
        txt_deploy_controller = _subst_namespace(subst=ns, string=txt_deploy_controller)

        yml_deploy_controller = yaml.safe_load_all(txt_deploy_controller)
        try:
            utils.replace_from_yaml(
                k8s_client=self.API_CLIENT,
                yaml_objects=yml_deploy_controller,
            )
        except utils.FailToCreateError as e:
            utils.echo(
                "Failed to update Orchest. Could not apply 'orchest-controller'"
                f" manifests: \n{e}",
                err=True,
            )
            raise e

        # Returns an iterator so we need to init it again to get the
        # `namespace` and `labels` of the `orchest-controller`
        # deployment for the next step.
        yml_deploy_controller = yaml.safe_load_all(txt_deploy_controller)
        while True:
            try:
                obj = next(yml_deploy_controller)

                if (
                    obj is not None
                    and obj["kind"] == "Deployment"
                    # NOTE: We need to assume something to not change in
                    # the controller deployment to be able to
                    # distinguish it from other defined deployments in
                    # the yaml file.
                    and obj["metadata"]["name"] == "orchest-controller"
                ):
                    controller_namespace = obj["metadata"]["namespace"]
                    controller_pod_labels = obj["spec"]["selector"]["matchLabels"]
                    break
            except StopIteration as e:
                utils.echo(
                    "Aborting update. No deployment manifest is defined for the"
                    " 'orchest-controller'.",
                    err=True,
                )
                raise e

        # Wait until the `orchest-controller` is successfully updated.
        # We don't accidentally want the old `orchest-controller` to
        # initiate the update process.
        # NOTE: use a while instead of watch command because the watch
        # could time out due to us changing labels in versions and thus
        # the watch command not returning anything.
        utils.echo("Updating the Orchest Controller deployment...")
        label_selector = ",".join(
            [f"{key}={value}" for key, value in controller_pod_labels.items()]
        )
        while True:
            resp = self.CORE_API.list_namespaced_pod(
                namespace=controller_namespace,
                label_selector=label_selector,
            )
            if resp is None or not resp.items:
                time.sleep(1)
                continue

            if len(resp.items) > 1:
                utils.echo(
                    "Aborting update. Multiple 'orchest-controller' pods found, whilst"
                    "expecting only 1.",
                    err=True,
                )
                raise RuntimeError()

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

        utils.echo("Updating the Orchest Cluster...")
        try:
            self.patch_namespaced_custom_object(
                name=cluster_name,
                namespace=ns,
                body={"spec": {"orchest": {"version": version}}},
            )
        except client.ApiException as e:
            utils.echo("Failed to update the Orchest Cluster version.", err=True)
            if e.status == 404:  # not found
                utils.echo(
                    f"The Orchest Cluster named '{cluster_name}' in namespace"
                    f" '{ns}' could not be found.",
                    err=True,
                )
            else:
                utils.echo(f"Reason: {e.reason}", err=True)
            raise e

        if watch_flag:
            self._wait_for_cluster_status(
                ns,
                cluster_name,
                None,
                ClusterStatus.RUNNING,
            )
            utils.echo("Successfully updated Orchest!")

    def patch(
        self,
        dev: t.Optional[bool],
        cloud: t.Optional[bool],
        log_level: t.Optional[LogLevel],
        socket_path: t.Optional[str],
        **kwargs,
    ) -> None:
        """Patches the Orchest Cluster."""

        def convert_to_strategic_merge_patch(patch_obj: t.Dict, obj: t.Dict) -> None:
            """Merges list[dict] of `patch_obj` with `obj`.

            `patch_obj` is changed in-place.

            Note:
                It is assumed that all lists inside the given objects
                are lists of dictionaries, i.e. list[dict], and those
                dictionaries are of the format::

                    {"name": ..., "value", ...}

            Precedence is given to `patch_obj`, i.e. if a dict["name"]
            entry exists in both the lists of `patch_obj` and `obj` then
            the dict of `patch_obj` is kept.

            Example:
                >>> patch = {
                ...     "key": [{"name": "patch-1", "value": "patch-1"}]
                ... }
                >>> obj = {"key": [{"name": "patch-1", "value": "obj-1"}
                ... ]}
                >>> convert_to_strategic_merge_patch(patch, obj)
                >>> patch
                ... {"key": [{"name": "patch-1", "value": "patch-1"}]}

            More information on what a strategic merge patch is can be
            found
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

        def annotate_obj(anotations: t.Dict[str, str], obj: t.Dict) -> None:
            """Annotates the `object` with the provided `annotations`.

            `obj` is changed in-place.

            Precedence is given to `annotations`, for example if a key
            is present in both, the value in annotations will be
            assigned to that key.

            """
            if "annotations" not in obj:
                obj["annotations"] = anotations
                return

            for key, value in anotations.items():
                obj["annotations"][key] = value

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
            self._run_pod_exec(
                ns,
                cluster_name,
                "orchest-api",
                command,
            )

        utils.echo("Patching the Orchest Cluster.")
        ns, cluster_name = kwargs["namespace"], kwargs["cluster_name"]

        if dev is None:
            env_var_dev = None
        elif dev:
            try:
                disable_telemetry()
            except RuntimeError as e:
                utils.echo(e, err=True)
                utils.echo("Failed to disable telemetry. Continuing.", err=True)

            env_var_dev = {"name": "FLASK_ENV", "value": "development"}

            _cmd = (
                "minikube start --cpus max --memory max "
                '--mount-string="$(pwd):/orchest-dev-repo" --mount'
            )
            utils.echo(
                "Note that when running in dev mode you need to have mounted the "
                "orchest repository into minikube. For example by running the "
                "following when creating the cluster, while being in the repo: "
                f"'{_cmd}'. The behaviour of mounting in minikube is driver dependent "
                "and has some open issues, so try to stay on the proven path. A "
                "cluster created through the scripts/install_minikube.sh script, "
                "for example, would lead to the mount only working on the master "
                "node, due to the kvm driver."
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
        # should be possible to define strategic merge on CRDs, but for
        # some reason we didn't get this to work:
        # https://kubernetes.io/docs/reference/using-api/server-side-apply/#custom-resources
        # Therefore, we first GET the custom object, PATCH it at runtime
        # our selves, then send the PATCH request.
        try:
            custom_object = self._get_namespaced_custom_object(ns, cluster_name)
        except CRObjectNotFound as e:
            utils.echo("Failed to patch Orchest Cluster.", err=True)
            utils.echo(e, err=True)
            raise e
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

        if socket_path is not None:
            annotate_obj(
                {"orchest.io/container-runtime-socket": socket_path},
                custom_object["metadata"],  # type: ignore
            )

        try:
            self.patch_namespaced_custom_object(
                name=cluster_name,
                namespace=ns,
                body={"spec": {"orchest": orchest_spec_patch}},
            )
        except client.ApiException as e:
            utils.echo("Failed to patch the Orchest Cluster.", err=True)
            if e.status == 404:  # not found
                utils.echo(
                    f"The Orchest Cluster named '{cluster_name}' in namespace"
                    f" '{ns}' could not be found.",
                    err=True,
                )
            else:
                utils.echo(f"Reason: {e.reason}", err=True)
            raise e
        else:
            utils.echo("Successfully patched the Orchest Cluster.")

        # Depending on the current cluster's state, `orchest patch`
        # should not wait for the cluster's state to reach the same
        # state again.  For example, when in RUNNING state then users
        # expect `orchest patch` to succeed once the cluster is in a
        # RUNNING state again.  However, when the cluster is in an ERROR
        # state then we don't know what the user wants to wait for.
        curr_status = _parse_cluster_status_from_custom_object(
            custom_object  # type: ignore
        )
        if curr_status in [ClusterStatus.RUNNING, ClusterStatus.STOPPED]:
            utils.echo(
                f"Waiting for Orchest Cluster status to become: {curr_status.value}."
            )
            # In case of STOPPED the spinner will run for 10s anyways.
            self._wait_for_cluster_status(
                ns,
                cluster_name,
                None,
                curr_status,
            )
        else:
            if curr_status is None:
                curr_status = ClusterStatus.UNKNOWN
            utils.echo(f"Orchest Cluster status is: {curr_status.value}")
            utils.echo(
                "You might want to try running:"
                f"\n\torchest status --wait={ClusterStatus.RUNNING.value}"
            )

    def version(self, json_flag: bool, latest_flag: bool, **kwargs) -> str:
        """Gets Orchest version."""
        try:
            if latest_flag:
                version = _fetch_latest_available_version(
                    curr_version=None, is_cloud=False
                )
            else:
                version = self._get_orchest_cluster_version(
                    kwargs["namespace"],
                    kwargs["cluster_name"],
                )

        except CRObjectNotFound as e:
            if json_flag:
                utils.jecho({})
            else:
                utils.echo("Failed to fetch Orchest Cluster version.", err=True)
                utils.echo(e, err=True)
            raise e

        except KeyError as e:
            if json_flag:
                utils.jecho({})
            else:
                utils.echo("Failed to fetch Orchest Cluster version.", err=True)
                utils.echo(
                    "Make sure your CLI version is compatible with the running"
                    " Orchest Cluster version.",
                    err=True,
                )
            raise e

        if json_flag:
            utils.jecho({"version": version})
        else:
            utils.echo(version)
        return version

    def status(
        self, json_flag: bool, wait_for_status: t.Optional[ClusterStatus], **kwargs
    ) -> t.Optional[str]:
        """Gets Orchest Cluster status."""
        ns, cluster_name = kwargs["namespace"], kwargs["cluster_name"]

        # NOTE: If an uncaught exception is raised, Python will exit
        # with exit code equal to 1.
        try:
            status = self._get_orchest_cluster_status(ns, cluster_name)
        except CRObjectNotFound as e:
            if json_flag:
                utils.jecho({})
            else:
                utils.echo("Failed to fetch Orchest Cluster status.", err=True)
                utils.echo(e, err=True)
            raise e

        if status is None:
            utils.echo(
                "Failed to fetch Orchest Cluster status. Please try again.", err=True
            )
            return None
        else:
            if json_flag:
                if wait_for_status is not None:
                    f = open(os.devnull, "w")
                    try:
                        visited_states = self._wait_for_cluster_status(
                            ns, cluster_name, status, wait_for_status, file=f
                        )
                    finally:
                        f.close()
                    utils.jecho(
                        {
                            "status": wait_for_status.value,
                            "previous_status": [
                                # Last state is current state so don't
                                # include it.
                                s.value
                                for s in visited_states[:-1]
                            ],
                        }
                    )

                else:
                    utils.jecho({"status": status.value})
            else:
                if wait_for_status is not None:
                    self._wait_for_cluster_status(
                        ns, cluster_name, status, wait_for_status
                    )
                else:
                    utils.echo(status.value)
            return status.value

    def stop(self, watch: bool, **kwargs) -> None:
        """Stops Orchest."""
        ns, cluster_name = kwargs["namespace"], kwargs["cluster_name"]

        utils.echo("Stopping the Orchest Cluster.")
        try:
            self.patch_namespaced_custom_object(
                name=cluster_name,
                namespace=ns,
                body={"spec": {"orchest": {"pause": True}}},
            )
        except client.ApiException as e:
            utils.echo("Failed to stop the Orchest Cluster.", err=True)
            if e.status == 404:  # not found
                utils.echo(
                    f"The Orchest Cluster named '{cluster_name}' in namespace"
                    f" '{ns}' could not be found.",
                    err=True,
                )
            else:
                utils.echo(f"Reason: {e.reason}", err=True)
            raise e

        if watch:
            self._wait_for_cluster_status(
                ns,
                cluster_name,
                None,
                ClusterStatus.STOPPED,
            )
            utils.echo("Successfully stopped Orchest.")

    def start(self, watch: bool, **kwargs) -> None:
        """Starts Orchest."""
        ns, cluster_name = kwargs["namespace"], kwargs["cluster_name"]

        utils.echo("Starting the Orchest Cluster.")
        try:
            self.patch_namespaced_custom_object(
                name=cluster_name,
                namespace=ns,
                body={"spec": {"orchest": {"pause": False}}},
            )
        except client.ApiException as e:
            utils.echo("Failed to start the Orchest Cluster.", err=True)
            if e.status == 404:  # not found
                utils.echo(
                    f"The Orchest Cluster named '{cluster_name}' in namespace"
                    f" '{ns}' could not be found.",
                    err=True,
                )
            else:
                utils.echo(f"Reason: {e.reason}", err=True)
            raise e

        if watch:
            self._wait_for_cluster_status(ns, cluster_name, None, ClusterStatus.RUNNING)
            utils.echo("Successfully started Orchest.")

    def restart(self, watch: bool, **kwargs) -> None:
        """Restarts Orchest."""
        ns, cluster_name = kwargs["namespace"], kwargs["cluster_name"]

        utils.echo("Restarting the Orchest Cluster.")
        try:
            status = self._get_orchest_cluster_status(ns, cluster_name)
        except CRObjectNotFound as e:
            utils.echo("Failed to restart the Orchest Cluster.", err=True)
            utils.echo(e, err=True)
            raise e

        try:
            if status == ClusterStatus.STOPPED:
                self.start(watch=watch, **kwargs)
            else:
                status = ClusterStatus.RUNNING
                self.patch_namespaced_custom_object(
                    name=cluster_name,
                    namespace=ns,
                    # NOTE: strategic merge does work on the annotations
                    # in the metadata.
                    # `RestartAnnotationKey` in the
                    # `orchest-controller`.
                    body={"metadata": {"annotations": {"orchest.io/restart": "true"}}},
                    # Don't replace the annotations instead merge with
                    # existing keys.
                    field_manager="StrategicMergePatch",
                )
        except client.ApiException as e:
            utils.echo("Failed to restart the Orchest Cluster.", err=True)
            utils.echo(f"Reason: {e.reason}", err=True)
            raise e

        if watch:
            self._wait_for_cluster_status(
                ns, cluster_name, status, ClusterStatus.RUNNING
            )
            utils.echo("Successfully restarted Orchest.")

    # Application command.
    def adduser(
        self,
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
                utils.echo(
                    (
                        "Can't use `--non-interactive-password` without "
                        "`--non-interactive`",
                    ),
                    err=True,
                )
                raise RuntimeError()
            if non_interactive_token:
                utils.echo(
                    "Can't use `--non-interactive-token` without `--non-interactive`",
                    err=True,
                )
                raise RuntimeError()

            password = click.prompt(
                "Password", hide_input=True, confirmation_prompt=True
            )
            if set_token:
                token = click.prompt("Token", hide_input=True, confirmation_prompt=True)
            else:
                token = None

        try:
            self._add_user(ns, cluster_name, username, password, is_admin, token)
        except ValueError as e:
            utils.echo(f"Failed to add specified user: {username}.", err=True)
            utils.echo(e, err=True)
            raise e
        except RuntimeError as e:
            utils.echo(f"Failed to add specified user: {username}.", err=True)
            # NOTE: A newline is already returned by the auth-server.
            utils.echo(e, err=True, nl=False)
            raise e

        utils.echo(
            f"Successfully added {'admin' if is_admin else ''} user: {username}."
        )

    def _add_user(
        self,
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

        self._run_pod_exec(
            ns,
            cluster_name,
            "auth-server",
            command,
        )

    def _run_pod_exec(
        self,
        ns: str,
        cluster_name: str,
        orchest_service: str,
        command: t.List[str],
        check_gate=True,
    ) -> None:
        """Runs `command` inside the pod defined by `orchest_service`.

        Raises:
            RuntimeError: If something went wrong when trying to run the
                command in the pod, or when the command did not return
                with a zero exit code.

        """

        def passes_gate(ns: str, cluster_name: str) -> t.Tuple[bool, str]:
            """Returns whether the Orchest Cluster is in a valid state.

            Returns:
                True, "": if Cluster is in a valid state.
                False, reason: if Cluster is in an invalid state.

            """
            try:
                status = self._get_orchest_cluster_status(ns, cluster_name)
            except CRObjectNotFound as e:
                return False, str(e)

            if status != ClusterStatus.RUNNING:
                reason = (
                    "The Orchest Cluster state is "
                    f"'{'unknown' if status is None else status.value}', whereas "
                    f"it needs to be '{ClusterStatus.RUNNING.value}'. Check:"
                    "\n\torchest status"
                )
                return False, reason

            return True, ""

        if check_gate:
            passed_gate, reason = passes_gate(ns, cluster_name)
            if not passed_gate:
                raise RuntimeError(f"Failed to pass gate: {reason}")

        pods = self.CORE_API.list_namespaced_pod(
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
            self.CORE_API.connect_get_namespaced_pod_exec,
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
        # NOTE: Timeout shouldn't be needed, but we don't want to keep
        # the WS connection open indefinitely if something goes wrong
        # when running the command.
        client.run_forever(timeout=20)
        if client.returncode != 0:
            raise RuntimeError(client.read_all())

    def _get_orchest_cluster_status(
        self, ns: str, cluster_name: str
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
        # switch to
        # `CUSTOM_OBJECT_API.get_namespaced_custom_object_status`
        custom_object = self._get_namespaced_custom_object(ns, cluster_name)
        custom_object = t.cast(t.Dict, custom_object)
        return _parse_cluster_status_from_custom_object(custom_object)

    def _get_namespaced_custom_object(
        self, ns: str, cluster_name: str, **kwargs
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
            custom_object = self.get_namespaced_custom_object(
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

    def _wait_for_cluster_status(
        self,
        namespace: str,
        cluster_name: str,
        curr_status: t.Optional[ClusterStatus],
        end_status: ClusterStatus,
        file: t.Optional[t.IO] = None,
    ) -> t.List[ClusterStatus]:

        if utils.has_click_context():
            return self._display_spinner(curr_status, end_status, file)

        # NOTE: Assumes the `orchest-controller` changes the status of
        # the Orchest Cluster based on the management command within 10s
        # and the initial request getting the cluster status succeeding
        # within that time as well. Meaning that the passed
        # `curr_status` is actually no longer the actual status of the
        # Cluster. Allowing the passed `curr_status` to equal the
        # `end_status` (without requiring double invocation of this
        # function, which would lead to other issues).
        invocation_time = time.time()

        err_file = sys.stderr if file is None else file

        if curr_status is None:
            curr_status = ClusterStatus.FETCHING
            # FETCHING isn't actually a state of the cluster.
            visited_states = []
        else:
            visited_states = [curr_status]
        prev_status = curr_status

        num_req_timeouts = 0
        while curr_status != end_status or (time.time() - invocation_time < 10):
            try:
                resp = self._get_namespaced_custom_object(
                    namespace, cluster_name, async_req=False
                )
            except client.ApiException as e:
                if e.status == 504:  # timeout
                    print("Failed to fetch Orchest cluster status.", file=err_file)

                    num_req_timeouts += 1
                    if num_req_timeouts > 3:
                        print(
                            (
                                "Request timeout was hit for the 3rd time. Stopping"
                                " displaying progress...\n",
                            ),
                            file=err_file,
                        )
                        raise

                if e.status == 404:  # not found
                    print(
                        (
                            "The CR Object defining the Orchest Cluster was removed"
                            " by an external process during installation.",
                        ),
                        file=err_file,
                    )
                    raise

            curr_status = _parse_cluster_status_from_custom_object(
                resp,
            )  # type: ignore

            if curr_status is None:
                curr_status = prev_status

            if curr_status != prev_status:
                prev_status = curr_status
                visited_states.append(curr_status)

            if curr_status != end_status:
                time.sleep(4)

        return visited_states

    def _display_spinner(
        self,
        curr_status: t.Optional[ClusterStatus],
        end_status: ClusterStatus,
        file: t.Optional[t.IO] = None,
    ) -> t.List[ClusterStatus]:
        """Displays a spinner until the end status is reached.

        The spinner is displayed in `file` which defaults to `STDOUT`.

        Note:
            The spinner is not "fool-proof" when running quick succinct
            CLI commands.

            For example: running <--> updating. Then when the cluster
            status is "updating", one can't infer whether that was due
            to the current invoked command or the next command. Thus the
            spinner can't know whether it should stop displaying.

            The spinner is displayed based on the cluster status, which
            is just one moment in time: the moment the request is
            returned.  Based on the ping of a user and the speed with
            which the `orchest-controller` changes the status of the
            cluster, we can't infer whether the `end_status` has already
            been reached.

            The implementation assumes the `end_status` is reached
            eventually and no concurrent/quick successive commands are
            issued.

        Note:
            Will run for at least 10 seconds as a safeguard to ensure
            that the `end_status` wasn't reached prematurely, e.g. the
            current status of the cluster is equal to end status on
            invocation of this function. The user probably invoked a
            command to change the state and thus the current state will
            probably soon change.

            For example running the `orchest restart` command whilst the
            cluster is in a RUNNING state.

        """

        def echo(*args, **kwargs):
            """Local echo function.

            Inside the function one can now call `echo` instead of
            always having to call `utils.echo(..., file=file)`.

            """
            nonlocal file

            if file is None:
                file = sys.stdout

            if kwargs.get("file") is None:
                return utils.echo(*args, file=file, **kwargs)
            else:
                return utils.echo(*args, **kwargs)

        # Get the required arguments to get the status of the custom
        # object from the click context.
        # If the assertion fails, try adding `watch=False` to the
        # command as to not to display a spinner.
        click_ctx = click.get_current_context(silent=True)
        assert click_ctx is not None, "Can only display spinner through CLI invocation."

        ns = t.cast(str, click_ctx.params.get("namespace"))
        cluster_name = t.cast(str, click_ctx.params.get("cluster_name"))

        # NOTE: Assumes the `orchest-controller` changes the status of
        # the Orchest Cluster based on the management command within 10s
        # and the initial request getting the cluster status succeeding
        # within that time as well. Meaning that the passed
        # `curr_status` is actually no longer the actual status of the
        # Cluster. Allowing the passed `curr_status` to equal the
        # `end_status` (without requiring double invocation of this
        # function, which would lead to other issues).
        invocation_time = time.time()

        try:
            # NOTE: Click's `echo` makes sure the ANSI characters work
            # cross-platform. For Windows it uses `colorama` to do so.
            echo("\033[?25l", nl=False)  # hide cursor

            # NOTE: Watching (using `watch.Watch().stream(...)`) is not
            # supported, thus we go for a loop instead:
            # https://github.com/kubernetes-client/python/issues/1679
            if curr_status is None:
                curr_status = ClusterStatus.FETCHING
                # FETCHING isn't actually a state of the cluster.
                visited_states = []
            else:
                visited_states = [curr_status]
            prev_status = curr_status

            num_req_timeouts = 0
            # Use `async_req` to make sure spinner is always loading.
            thread = self._get_namespaced_custom_object(
                ns, cluster_name, async_req=True
            )
            while curr_status != end_status or (time.time() - invocation_time < 10):
                thread = t.cast("AsyncResult", thread)
                if thread.ready():
                    try:
                        resp = thread.get()
                    except client.ApiException as e:
                        if e.status == 504:  # timeout
                            echo("\r", nl=False)  # Move cursor to beginning of line
                            echo("\033[K", nl=False)  # Erase until end of line
                            echo("🙅 Failed to fetch Orchest cluster status.", err=True)

                            num_req_timeouts += 1
                            if num_req_timeouts < 3:
                                thread = self._get_namespaced_custom_object(
                                    ns, cluster_name, async_req=True
                                )
                                continue
                            else:
                                echo(
                                    "Request timeout was hit for the 3rd time. Stopping"
                                    " displaying progress...\n"
                                    f"Note that 'orchest {click_ctx.command.name}'"
                                    " could have completed regardless.",
                                    err=True,
                                )
                                raise RuntimeError()

                        echo(err=True)  # newline
                        echo(f"🙅 Failed to {click_ctx.command.name}.", err=True)
                        if e.status == 404:  # not found
                            echo(
                                "The CR Object defining the Orchest Cluster was removed"
                                " by an external process during installation.",
                                err=True,
                            )
                            raise RuntimeError()
                        else:
                            raise

                    curr_status = _parse_cluster_status_from_custom_object(
                        resp,
                    )  # type: ignore
                    thread = self._get_namespaced_custom_object(
                        ns, cluster_name, async_req=True
                    )

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
                    visited_states.append(curr_status)

                    # Otherwise the loading spinner could again be shown
                    # with `curr_status` (even though we just indicated
                    # it was finished, i.e. the cluster is now in a new
                    # state).
                    if curr_status != end_status:
                        thread.wait()  # type: ignore

            # In the case where the spinner is running just because of
            # the minimal time limit, the loading spinner would be the
            # last printed line. Thus we redraw the line to make sure
            # the last status is indicated as finished/reached.
            if prev_status == curr_status and curr_status == end_status:
                echo("\r", nl=False)
                echo("\033[K", nl=False)
                echo(f"🏁 {curr_status.value}", nl=False)

            return visited_states
        finally:
            echo("\033[?25h", nl=True)  # show cursor

    def _get_orchest_cluster_version(self, ns: str, cluster_name: str) -> str:
        """Gets the current version of the Orchest Cluster.

        Raises:
            CRObjectNotFound: If the Orchest Cluster CR Object couldn't
                be found.
            KeyError: If the `version` entry couldn't be accessed from
                the CR Object.

        """
        custom_object = self._get_namespaced_custom_object(ns, cluster_name)
        return custom_object["spec"]["orchest"]["version"]  # type: ignore

    def _is_orchest_in_cloud_mode(self, ns: str, cluster_name: str) -> bool:
        """Answers whether Orchest is running in cloud mode or not.

        Raises:
            CRObjectNotFound: If the Orchest Cluster CR Object couldn't
                be found.
            KeyError: If the returned custom object has an unexpected
                format.

        """
        custom_object = self._get_namespaced_custom_object(ns, cluster_name)
        env = custom_object["spec"]["orchest"]["orchestWebServer"][
            "env"
        ]  # type: ignore
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


def _fetch_orchest_controller_manifests(version: str, manifest_file_name: str) -> str:
    url = (
        "https://github.com/orchest/orchest"
        f"/releases/download/{version}/{manifest_file_name}"
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
