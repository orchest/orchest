import json
import logging
import time

import docker

from _orchest.internals.utils import docker_images_list_safe
from app.connections import docker_client

__DOCKERFILE_RESERVED_FLAG = "_ORCHEST_RESERVED_FLAG_"


def build_docker_image(
    image_name,
    build_context,
    dockerfile_path,
    user_logs_file_object,
    complete_logs_path,
):
    """Build a docker image with the given tag, context_path and docker
        file.

    Args:
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

        # connect to docker and issue the build
        generator = docker_client.api.build(
            path=build_context["snapshot_path"],
            dockerfile=dockerfile_path,
            tag=image_name,
            rm=True,
            nocache=True,
        )

        flag = __DOCKERFILE_RESERVED_FLAG + "\n"
        found_beginning_flag = False
        found_ending_flag = False
        had_errors = False
        while True:
            try:
                output = next(generator)
                json_output = json.loads(output)
                # Checking for logs. Even if we consider to be done with
                # the logs (found_ending_flag == True) we do not break
                # out of the while loop because the build needs to keep
                # going, both for error reporting and for actually
                # allowing the build to keep going, which would not
                # happen if the process exits.
                if "stream" in json_output:
                    stream = json_output["stream"]

                    complete_logs_file_object.write(stream)
                    complete_logs_file_object.flush()

                    if not found_ending_flag:
                        # Beginning flag not found --> do not log.
                        # Beginning flag found --> log until you find
                        # the ending flag.
                        if not found_beginning_flag:
                            found_beginning_flag = stream.startswith(flag)
                            if found_beginning_flag:
                                stream = stream.replace(flag, "")
                                if len(stream) > 1:
                                    user_logs_file_object.write(stream)
                        else:
                            found_ending_flag = stream.endswith(flag)
                            if not found_ending_flag:
                                user_logs_file_object.write(stream)

                had_errors = (
                    had_errors
                    or ("error" in json_output)
                    or ("errorDetail" in json_output)
                )

            # Build is done.
            except StopIteration:
                break
            except ValueError:
                pass
            # Any other exception will lead to a fail of the build.
            except Exception:
                had_errors = True

        if had_errors:
            msg = (
                "There was a problem building the image. "
                "Either the base image does not exist or the "
                "building script had a non 0 exit code, build failed\n"
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
