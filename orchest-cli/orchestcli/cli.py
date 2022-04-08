"""The Orchest CLI.

Polling the API from your browser:
    kubectl proxy --port=8000
Then go to a URL, e.g:
http://localhost:8000/apis/orchest.io/v1alpha1/namespaces/orchest/orchestclusters/cluster-1

Example working with custom objects:
https://github.com/kubernetes-client/python/blob/v21.7.0/kubernetes/docs/CustomObjectsApi.md

"""

import enum
import time

import click
from kubernetes import client, config

config.load_kube_config()

# https://github.com/kubernetes-client/python/blob/v21.7.0/kubernetes/docs/CustomObjectsApi.md
API = client.CustomObjectsApi()

CONTEXT_SETTINGS = {
    "help_option_names": ["-h", "--help"],
}


@click.group(context_settings=CONTEXT_SETTINGS)
def cli():
    """The Orchest CLI to manage your Orchest Cluster on Kubernetes."""
    pass


# NOTE: Schema to be kept in sync with:
# `services/orchest-controller/pkg/apis/orchest/v1alpha1/types.go`
class ClusterStatus(enum.Enum):
    INITIALIZING = "Initializing"
    DEPLOYING_ARGO = "DeployingArgo"
    DEPLOYING_REGISTRY = "DeployingRegistry"
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


@cli.command()
def install():
    """Install Orchest."""
    click.echo("Installing Orchest...")
    namespace = "orchest"

    # TODO: Do we want to put everything in JSON? Probably easier to
    # merge it with flags passed by the user.
    my_resource = {
        "apiVersion": "orchest.io/v1alpha1",
        "kind": "OrchestCluster",
        "metadata": {
            "name": "cluster-1",
            "namespace": "orchest",
        },
        "spec": {
            "singleNode": True,
            "orchest": {
                "nodeAgent": {"image": "orchest/node-agent"},
            },
        },
    }

    # create the resource
    API.create_namespaced_custom_object(
        group="orchest.io",
        version="v1alpha1",
        namespace=namespace,
        plural="orchestclusters",
        body=my_resource,
    )
    print("Resource created")

    # NOTE: Watching (using `watch.Watch().stream(...)`) is not
    # supported, thus we go for a loop instead:
    # https://github.com/kubernetes-client/python/issues/1679
    curr_status = ClusterStatus.INITIALIZING
    end_status = ClusterStatus.PENDING
    while curr_status != end_status:
        # TODO: The moment the `/status` endpoint is implemented we can
        # switch to `API.get_namespaced_custom_object_status`
        resource = API.get_namespaced_custom_object(
            group="orchest.io",
            version="v1alpha1",
            name="cluster-1",
            namespace=namespace,
            plural="orchestclusters",
        )
        try:
            curr_status = ClusterStatus(resource["status"]["state"])
        except KeyError:
            # NOTE: KeyError can get hit due to `"status"` not yet
            # being present in the response:
            # https://github.com/kubernetes-client/python/issues/1772
            pass

        print(curr_status)
        time.sleep(1)
