import logging
import os
import requests
import uuid

import docker
from docker.types import DeviceRequest


def get_mount(source, target, form="docker-sdk"):
    if form == "docker-sdk":
        return {source: {"bind": target, "mode": "rw"}}
    elif form == "docker-engine":
        return f"{source}:{target}"


def run_orchest_ctl(client, command):

    return client.containers.run(
        "orchest/orchest-ctl:latest",
        command,
        name="orchest-ctl-" + str(uuid.uuid4()),
        detach=True,
        auto_remove=True,
        mounts=[
            docker.types.Mount(
                source="/var/run/docker.sock",
                target="/var/run/docker.sock",
                type="bind",
            ),
            docker.types.Mount(
                source=os.environ.get("HOST_REPO_DIR"),
                target="/orchest-host",
                type="bind",
            ),
        ],
        environment={
            "HOST_CONFIG_DIR": os.environ.get("HOST_CONFIG_DIR"),
            "HOST_REPO_DIR": os.environ.get("HOST_REPO_DIR"),
            "HOST_USER_DIR": os.environ.get("HOST_USER_DIR"),
        },
    )


def get_device_requests(environment_uuid, project_uuid, form="docker-sdk"):

    device_requests = []

    capabilities = get_environment_capabilities(environment_uuid, project_uuid)

    if len(capabilities) > 0:

        if form == "docker-sdk":
            device_requests.append(DeviceRequest(count=-1, capabilities=[capabilities]))
        elif form == "docker-engine":
            device_requests.append(
                {"Driver": "nvidia", "Count": -1, "Capabilities": [capabilities]}
            )

    return device_requests


def get_environment_capabilities(environment_uuid, project_uuid):

    capabilities = []

    try:
        response = requests.get(
            "http://orchest-webserver/store/environments/%s/%s"
            % (project_uuid, environment_uuid)
        )
        response.raise_for_status()
    except Exception as e:
        logging.error(
            "Failed to get environment for environment_uuid[%s] and project_uuid[%s]. Error: %s (%s)"
            % (environment_uuid, project_uuid, e, type(e))
        )
        return capabilities

    environment = response.json()

    if environment["gpu_support"]:
        capabilities += ["gpu", "utility", "compute"]

    return capabilities


def get_orchest_mounts(project_dir, host_project_dir, mount_form="docker-sdk"):
    """
    Prepare all mounts that are needed to run Orchest.

    Args:
        mount_form: One of "docker-sdk" or "docker-engine". The former
            is used for the "docker-py" package and the latter for
            "aiodocker".

    """

    project_dir_mount = get_mount(
        source=host_project_dir, target=project_dir, form=mount_form
    )

    if mount_form == "docker-sdk":
        mounts = project_dir_mount
    else:
        mounts = [project_dir_mount]

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

            source = datasource["connection_details"]["absolute_host_path"]
            mount = get_mount(
                source=source,
                target=target_path,
                form=mount_form,
            )
            if mount_form == "docker-sdk":
                mounts[source] = mount[source]
            else:
                mounts.append(mount)

    return mounts


def docker_images_list_safe(docker_client, *args, attempt_count=10, **kwargs):

    for _ in range(attempt_count):
        try:
            return docker_client.images.list(*args, **kwargs)
        except docker.errors.ImageNotFound as e:
            logging.debug(
                "Internal race condition triggered in docker_client.images.list(): %s"
                % e
            )
        except Exception as e:
            logging.debug("Failed to call docker_client.images.list(): %s" % e)
            return None
