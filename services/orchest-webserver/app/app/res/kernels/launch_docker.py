import os
import sys
import argparse
from docker.client import DockerClient
from docker.types import EndpointSpec, RestartPolicy
import urllib3
import requests

urllib3.disable_warnings()

# Set env to False if the container should be left around for debug purposes, etc.
remove_container = bool(os.getenv("EG_REMOVE_CONTAINER", "True").lower() == "true")
swarm_mode = bool(os.getenv("EG_DOCKER_MODE", "swarm").lower() == "swarm")


def get_orchest_mounts(param_env):
    """Prepare all mounts that are needed to run Orchest.

    Note:
        Trying to put all Orchest related code inside this function to
        ease maintainability when the EG gets updated.

    """
    from docker.types import Mount

    pipeline_dir_mount = Mount(
        target=param_env.get("KERNEL_WORKING_DIR"),
        source=param_env.get("ORCHEST_HOST_PIPELINE_DIR"),
        type="bind",
    )

    # TODO: Do we want to add our internal library to the EG just so
    #       that we can use the `_config` values?
    uuid = param_env.get("ORCHEST_PIPELINE_UUID")
    temp_dir_mount = Mount(
        # target=_config.TEMP_DIRECTORY_PATH,
        target="/tmp/orchest",
        source=f"tmp-orchest-{uuid}",
        # source=_config.TEMP_VOLUME_NAME.format(uuid=uuid),
        type="volume",
    )

    mounts = [pipeline_dir_mount, temp_dir_mount]

    # Mounts for datasources.
    try:
        response = requests.get("http://orchest-webserver/store/datasources")
        response.raise_for_status()

    except Exception as e:
        print(e)

    else:
        datasources = response.json()
        for datasource in datasources:
            if datasource["source_type"] != "host-directory":
                continue

            # the default (host) /userdata/data should be mounted in /data
            if datasource["connection_details"]["absolute_host_path"].endswith(
                "/userdir/data"
            ):
                target_path = "/data"
            else:
                target_path = "/mounts/%s" % datasource["name"]

            mount = Mount(
                target=target_path,
                source=datasource["connection_details"]["absolute_host_path"],
                type="bind",
            )
            mounts.append(mount)

    return mounts


def launch_docker_kernel(kernel_id, response_addr, spark_context_init_mode):
    # Launches a containerized kernel.

    # Can't proceed if no image was specified.
    image_name = os.environ.get("KERNEL_IMAGE", None)
    if image_name is None:
        sys.exit(
            "ERROR - KERNEL_IMAGE not found in environment - kernel launch terminating!"
        )

    # Container name is composed of KERNEL_USERNAME and KERNEL_ID
    container_name = os.environ.get("KERNEL_USERNAME", "") + "-" + kernel_id

    # Determine network. If EG_DOCKER_NETWORK has not been propagated, fall back to 'bridge'...
    docker_network = os.environ.get("EG_DOCKER_NETWORK", "bridge")

    # Build labels - these will be modelled similar to kubernetes: kernel_id, component, app, ...
    labels = dict()
    labels["kernel_id"] = kernel_id
    labels["component"] = "kernel"
    labels["app"] = "enterprise-gateway"

    # Capture env parameters...
    param_env = dict()
    param_env["EG_RESPONSE_ADDRESS"] = response_addr
    param_env["KERNEL_SPARK_CONTEXT_INIT_MODE"] = spark_context_init_mode

    # Since the environment is specific to the kernel (per env stanza of kernelspec, KERNEL_ and ENV_WHITELIST)
    # just add the env here.
    param_env.update(os.environ)
    param_env.pop(
        "PATH"
    )  # Let the image PATH be used.  Since this is relative to images, we're probably safe.

    user = param_env.get("KERNEL_UID")
    group = param_env.get("KERNEL_GID")

    # setup common args
    kwargs = dict()
    kwargs["name"] = container_name
    kwargs["user"] = user
    kwargs["labels"] = labels

    client = DockerClient.from_env()
    if swarm_mode:
        print("Started Jupyter kernel in swarm-mode")
        networks = list()
        networks.append(docker_network)
        mounts = list()
        mounts.append(
            "/usr/local/share/jupyter/kernels:/usr/local/share/jupyter/kernels:ro"
        )
        endpoint_spec = EndpointSpec(mode="dnsrr")
        restart_policy = RestartPolicy(condition="none")

        # finish args setup
        kwargs["env"] = param_env
        kwargs["endpoint_spec"] = endpoint_spec
        kwargs["restart_policy"] = restart_policy
        kwargs["container_labels"] = labels
        kwargs["networks"] = networks
        kwargs["groups"] = [group, "100"]
        if param_env.get("KERNEL_WORKING_DIR"):
            kwargs["workdir"] = param_env.get("KERNEL_WORKING_DIR")
        # kwargs['mounts'] = mounts   # Enable if necessary
        # print("service args: {}".format(kwargs))  # useful for debug
        kernel_service = client.services.create(image_name, **kwargs)
    else:
        print("Started Jupyter kernel in normal docker mode")

        # Note: seems to me that the kernels don't need to be mounted on a container that runs a single kernel

        # mount the kernel working directory from EG to kernel container

        # finish args setup
        kwargs["hostname"] = container_name
        kwargs["environment"] = param_env
        kwargs["remove"] = remove_container
        kwargs["network"] = docker_network
        kwargs["group_add"] = [
            group,
            "100",
        ]  # NOTE: "group_add" for newer versions of docker
        kwargs["detach"] = True
        if param_env.get("KERNEL_WORKING_DIR"):
            kwargs["working_dir"] = param_env.get("KERNEL_WORKING_DIR")

        # print("container args: {}".format(kwargs))  # useful for debug
        orchest_mounts = get_orchest_mounts(param_env)
        kernel_container = client.containers.run(
            image_name, mounts=orchest_mounts, **kwargs
        )


if __name__ == "__main__":
    """
    Usage: launch_docker_kernel
                [--RemoteProcessProxy.kernel-id <kernel_id>]
                [--RemoteProcessProxy.response-address <response_addr>]
                [--RemoteProcessProxy.spark-context-initialization-mode <mode>]
    """

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--RemoteProcessProxy.kernel-id",
        dest="kernel_id",
        nargs="?",
        help="Indicates the id associated with the launched kernel.",
    )
    parser.add_argument(
        "--RemoteProcessProxy.response-address",
        dest="response_address",
        nargs="?",
        metavar="<ip>:<port>",
        help="Connection address (<ip>:<port>) for returning connection file",
    )
    parser.add_argument(
        "--RemoteProcessProxy.spark-context-initialization-mode",
        dest="spark_context_init_mode",
        nargs="?",
        help="Indicates whether or how a spark context should be created",
        default="none",
    )

    arguments = vars(parser.parse_args())
    kernel_id = arguments["kernel_id"]
    response_addr = arguments["response_address"]
    spark_context_init_mode = arguments["spark_context_init_mode"]

    launch_docker_kernel(kernel_id, response_addr, spark_context_init_mode)
