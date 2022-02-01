import logging
import time

import docker
from kubernetes import k8s_client, watch

from _orchest.internals.utils import docker_images_list_safe
from app import utils
from app.connections import docker_client, k8s_api, k8s_custom_obj_api

__DOCKERFILE_RESERVED_FLAG = "_ORCHEST_RESERVED_FLAG_"


def _generate_image_build_workflow_manifest(
    workflow_name, image_name, build_context, dockerfile_path
) -> dict:
    manifest = {
        "apiVersion": "argoproj.io/v1alpha1",
        "kind": "Workflow",
        "metadata": {"name": workflow_name},
        "spec": {
            "entrypoint": "build-env",
            "templates": [
                {
                    "name": "build-env",
                    "container": {
                        "name": "kaniko",
                        "image": "gcr.io/kaniko-project/executor:latest",
                        "command": ["/kaniko/executor"],
                        "args": [
                            f"--dockerfile={dockerfile_path}",
                            f"--context=dir://{build_context}",
                            f"--destination=registry.kube-system.svc.cluster.local/{image_name}",  # noqa
                            "--cleanup",
                            "--log-format=json",
                            "--reproducible",
                            "--insecure",
                            "--cache=true",
                            "--cache-repo=registry.kube-system.svc.cluster.local",
                            "--registry-mirror=registry.kube-system.svc.cluster.local",
                        ],
                        "volumeMounts": [{"name": "userdir", "mountPath": "/userdir"}],
                    },
                }
            ],
            # The celery task actually takes care of deleting the
            # workflow, this is just a failsafe.
            "ttlStrategy": {
                "secondsAfterCompletion": 1000,
                "secondsAfterSuccess": 1000,
                "secondsAfterFailure": 1000,
            },
            "dnsPolicy": "ClusterFirst",
            "restartPolicy": "Never",
            "volumes": [
                {
                    "name": "userdir",
                    "hostPath": {
                        "path": "/var/lib/orchest/userdir",
                        "type": "DirectoryOrCreate",
                    },
                }
            ],
        },
    }
    return manifest


def build_docker_image(
    task_uuid,
    image_name,
    build_context,
    dockerfile_path,
    user_logs_file_object,
    complete_logs_path,
):
    """Build a docker image with the given tag, context_path and docker
        file.

    Args:
        task_uuid:
        image_name:
        build_context:
        dockerfile_path:
        user_logs_file_object: file object to which logs from the user
            script are written.
        complete_logs_path: path to where to store the full logs are
            written.

    Returns:

    """
    with open(complete_logs_path, "w") as complete_logs_file_object:

        try:
            docker_client.images.get(build_context["base_image"])
        except docker.errors.ImageNotFound as e:
            complete_logs_file_object.write(
                (
                    "Docker error ImageNotFound: need to pull image as "
                    "part of the build. Error: %s"
                )
                % e
            )
            user_logs_file_object.write(
                (
                    f'Base image `{build_context["base_image"]}` not found. '
                    "Pulling image...\n"
                )
            )
        except Exception:
            complete_logs_file_object.write(
                "docker_client.images.get() call to Docker API failed."
            )

        pod_name = f"image-build-task-{task_uuid}"
        manifest = _generate_image_build_workflow_manifest(
            pod_name, image_name, build_context["snapshot_path"], dockerfile_path
        )
        k8s_custom_obj_api.create_namespaced_custom_object(
            "argoproj.io", "v1alpha1", "orchest", "workflows", body=manifest
        )

        for _ in range(100):
            try:
                resp = k8s_api.read_namespaced_pod(name=pod_name, namespace="orchest")
            except k8s_client.ApiException as e:
                if e.status != 404:
                    raise
                time.sleep(1)
            else:
                status = resp.status.phase
                if status in ["Running", "Succeeded", "Failed", "Unknown"]:
                    break
            time.sleep(1)
        else:
            # Still Pending, consider this an issue.
            raise Exception()

        flag = __DOCKERFILE_RESERVED_FLAG
        found_beginning_flag = False
        found_ending_flag = False
        w = watch.Watch()
        for event in w.stream(
            k8s_api.read_namespaced_pod_log,
            name=pod_name,
            container="main",
            namespace="orchest",
            follow=True,
        ):
            complete_logs_file_object.write(f"{event}\n")
            complete_logs_file_object.flush()
            if not found_ending_flag:
                # Beginning flag not found --> do not log.
                # Beginning flag found --> log until you find
                # the ending flag.
                if not found_beginning_flag:
                    found_beginning_flag = event.startswith(flag)
                    if found_beginning_flag:
                        event = event.replace(flag, "")
                        if len(event) > 0:
                            user_logs_file_object.write(event + "\n")
                else:
                    found_ending_flag = event.endswith(flag)
                    if not found_ending_flag:
                        user_logs_file_object.write(event + "\n")
                    else:
                        user_logs_file_object.write("Storing image...\n")

        # The w.stream loop exits once the pod has finished running.
        resp = k8s_api.read_namespaced_pod(name=pod_name, namespace="orchest")

        if resp.status.phase == "Failed":
            msg = (
                "There was a problem building the image. "
                "Either the base image does not exist or the "
                "building script had a non 0 exit code, build failed.\n"
            )
            user_logs_file_object.write(msg)
            complete_logs_file_object.write(msg)
            complete_logs_file_object.flush()
            return "FAILURE"

        return "SUCCESS"


def cleanup_docker_artifacts(filters):
    """Cleanup container(s) and images given filters.

    Args:
        filters:

    Returns:

    """
    # Actually we are just looking for a single container, but the
    # syntax is the same as looking for N.
    containers_to_prune = docker_client.containers.list(filters=filters, all=True)
    tries = 0
    while containers_to_prune:
        docker_client.containers.prune(filters=filters)
        containers_to_prune = docker_client.containers.list(filters=filters, all=True)
        # Be as responsive as possible, only sleep at the first
        # iteration if necessary.
        if containers_to_prune:
            tries += 1
            if tries > 100:
                logging.error(
                    "Could not prune containers: %s"
                    % [con.attrs for con in containers_to_prune]
                )
                break
            time.sleep(1)

    # Only get to this point once there are no depending containers>
    # We DO NOT use all=True as an argument here because it will also
    # return intermediate layers, which will not be pruneable if the
    # build is successful. Those layers will be automatically deleted
    # when the env image is deleted. What we are actually doing here
    # is getting the last image created by the build process by getting
    # all the images created by the build process. Removing n-1 of them
    # will result in a no op, but 1 of them will cause the "ancestor
    # images to be removed as well.
    images_to_prune = docker_images_list_safe(docker_client, filters=filters)
    tries = 0
    while images_to_prune:
        docker_client.images.prune(filters=filters)
        images_to_prune = docker_images_list_safe(docker_client, filters=filters)
        # Be as responsive as possible, only sleep at the first
        # iteration if necessary.
        if images_to_prune:
            tries += 1
            if tries > 100:
                logging.error(
                    "Could not prune images: %s"
                    % [img.attrs for img in images_to_prune]
                )
                break
            time.sleep(1)


def delete_project_environment_dangling_images(project_uuid, environment_uuid):
    """Removes dangling images related to an environment.

    Dangling images are images that have been left nameless and
    tag-less and which are not referenced by any run
    or job which are pending or running.

    Args:
        project_uuid:
        environment_uuid:
    """
    # Look only through runs belonging to the project consider only
    # docker ids related to the environment_uuid.
    filters = {
        "label": [
            "_orchest_env_build_is_intermediate=0",
            f"_orchest_project_uuid={project_uuid}",
            f"_orchest_environment_uuid={environment_uuid}",
        ]
    }

    project_env_images = docker_images_list_safe(docker_client, filters=filters)

    for docker_img in project_env_images:
        utils.remove_if_dangling(docker_img)


def delete_project_dangling_images(project_uuid):
    """Removes dangling images related to a project.

    Dangling images are images that have been left nameless and
    tag-less and which are not referenced by any run
    or job which are pending or running.

    Args:
        project_uuid:
    """
    # Look only through runs belonging to the project.
    filters = {
        "label": [
            "_orchest_env_build_is_intermediate=0",
            f"_orchest_project_uuid={project_uuid}",
        ]
    }

    project_images = docker_images_list_safe(docker_client, filters=filters)

    for docker_img in project_images:
        utils.remove_if_dangling(docker_img)
