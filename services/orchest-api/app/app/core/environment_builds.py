import json
import logging
import os
import time
from datetime import datetime
from typing import Any

import docker
import requests
from celery.contrib.abortable import AbortableAsyncResult
from config import CONFIG_CLASS

from _orchest.internals import config as _config
from _orchest.internals.utils import docker_images_list_safe
from app.connections import docker_client
from app.core.sio_streamed_task import SioStreamedTask

__DOCKERFILE_RESERVED_FLAG = "_ORCHEST_RESERVED_FLAG_"
__ENV_BUILD_FULL_LOGS_DIRECTORY = "/tmp/environment_builds_logs"


def cleanup_env_build_docker_artifacts(filters):
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


def update_environment_build_status(
    status: str,
    session: requests.sessions.Session,
    environment_build_uuid,
) -> Any:
    """Update environment build status."""
    data = {"status": status}
    if data["status"] == "STARTED":
        data["started_time"] = datetime.utcnow().isoformat()
    elif data["status"] in ["SUCCESS", "FAILURE"]:
        data["finished_time"] = datetime.utcnow().isoformat()

    url = (
        f"{CONFIG_CLASS.ORCHEST_API_ADDRESS}/environment-builds/"
        "{environment_build_uuid}"
    )

    with session.put(url, json=data) as response:
        return response.json()


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
                # happen if we process exits.
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


def write_environment_dockerfile(
    base_image, task_uuid, project_uuid, env_uuid, work_dir, bash_script, flag, path
):
    """Write a custom dockerfile with the given specifications.

    This dockerfile is built in an ad-hoc way to later be able to only
    log messages related to the user script. Note that the produced
    dockerfile will make it so that the entire context is copied.

    Args:
        base_image: Base image of the docker file.
        task_uuid:
        project_uuid:
        env_uuid:
        work_dir: Working directory.
        bash_script: Script to run in a RUN command.
        flag: Flag to use to be able to differentiate between logs of
            the bash_script and logs to be ignored.
        path: Where to save the file.

    Returns:

    """
    statements = []
    statements.append(f"FROM {base_image}")
    # use this to cleanup in case of failure
    statements.append("LABEL _orchest_env_build_is_intermediate=1")
    statements.append(f"LABEL _orchest_env_build_task_uuid={task_uuid}")
    statements.append(f"LABEL _orchest_project_uuid={project_uuid}")
    statements.append(f"LABEL _orchest_environment_uuid={env_uuid}")

    # Copy the entire context, that is, given the current use case, that
    # we are copying the project directory (from the snapshot) into the
    # docker image that is to be built, this allows the user defined
    # script defined through orchest to make use of files that are part
    # of its project, e.g. a requirements.txt or other scripts.
    statements.append(f"COPY . \"{os.path.join('/', work_dir)}\"")

    # Note: commands are concatenated with && because this way an
    # exit_code != 0 will bubble up and cause the docker build to fail,
    # as it should. The bash script is removed so that the user won't
    # be able to see it after the build is done.
    statements.append(
        f'RUN cd "{os.path.join("/", work_dir)}" '
        "&& sudo chown -R :$(id -g) . "
        "&& sudo find . -type d -exec chmod g+rwxs {} \; "
        "&& sudo find . -type f -exec chmod g+rwx {} \; "
        "&& sudo chmod g+rwx . "
        f'&& echo "{flag}" '
        f"&& bash {bash_script} "
        f'&& echo "{flag}" '
        f"&& sudo rm {bash_script}"
    )
    statements.append("LABEL _orchest_env_build_is_intermediate=0")

    statements = "\n".join(statements)

    with open(path, "w") as dockerfile:
        dockerfile.write(statements)


def check_environment_correctness(project_uuid, environment_uuid, project_path):
    """A series of sanity checks that needs to be passed.

    Args:
        project_uuid:
        environment_uuid:
        project_path:

    Returns:

    Raises:
        OSError if the project path is missing, if the environment
            within the project cannot be found, if the environment
            properties.json cannot be found or if the user bash script
            cannot be found.
        ValueError if project_uuid, environment_uuid, base_image are
            incorrect or missing.

    """
    if not os.path.exists(project_path):
        raise OSError(f"Project path {project_path} does not exist")

    environment_path = os.path.join(
        project_path, f".orchest/environments/{environment_uuid}"
    )
    if not os.path.exists(environment_path):
        raise OSError(f"Environment path {environment_path} does not exist")

    environment_properties = os.path.join(environment_path, "properties.json")
    if not os.path.isfile(environment_properties):
        raise OSError("Environment properties file (properties.json) not found")

    environment_user_script = os.path.join(
        environment_path, _config.ENV_SETUP_SCRIPT_FILE_NAME
    )
    if not os.path.isfile(environment_user_script):
        raise OSError(
            f"Environment user script ({_config.ENV_SETUP_SCRIPT_FILE_NAME}) not found"
        )

    with open(environment_properties) as json_file:
        environment_properties = json.load(json_file)

        if "base_image" not in environment_properties:
            raise ValueError("base_image not found in environment properties.json")

        if "uuid" not in environment_properties:
            raise ValueError("uuid not found in environment properties.json")

        if environment_properties["uuid"] != environment_uuid:
            raise ValueError(
                f"The environment properties environment "
                f"uuid {environment_properties['uuid']} differs {environment_uuid}"
            )


def prepare_build_context(task_uuid, project_uuid, environment_uuid, project_path):
    """Prepares the docker build context for a given environment.

    Prepares the docker build context by taking a snapshot of the
    project directory, and using this snapshot as a context in which the
    ad-hoc docker file will be placed. This dockerfile is built in a way
    to respect the environment properties (base image, user bash script,
    etc.) while also allowing to log only the messages that are related
    to the user script while building the docker image.

    Args:
        task_uuid:
        project_uuid:
        environment_uuid:
        project_path:

    Returns:
        Path to the prepared context.

    Raises:
        See the check_environment_correctness_function
    """
    dockerfile_name = task_uuid
    # the project path we receive is relative to the projects directory
    userdir_project_path = os.path.join("/userdir/projects", project_path)

    # sanity checks, if not respected exception will be raised
    check_environment_correctness(project_uuid, environment_uuid, userdir_project_path)

    # make a snapshot of the project state
    snapshot_path = f"/tmp/{dockerfile_name}"
    os.system('rm -rf "%s"' % snapshot_path)
    os.system('cp -R "%s" "%s"' % (userdir_project_path, snapshot_path))
    # take the environment from the snapshot
    environment_path = os.path.join(
        snapshot_path, f".orchest/environments/{environment_uuid}"
    )

    # build the docker file and move it to the context
    with open(os.path.join(environment_path, "properties.json")) as json_file:
        environment_properties = json.load(json_file)

        # use the task_uuid to avoid clashing with user stuff
        docker_file_name = dockerfile_name
        bash_script_name = f".{dockerfile_name}.sh"
        write_environment_dockerfile(
            environment_properties["base_image"],
            task_uuid,
            project_uuid,
            environment_uuid,
            _config.PROJECT_DIR,
            bash_script_name,
            __DOCKERFILE_RESERVED_FLAG,
            os.path.join(snapshot_path, docker_file_name),
        )

        # move the startup script to the context
        os.system(
            'cp "%s" "%s"'
            % (
                os.path.join(environment_path, _config.ENV_SETUP_SCRIPT_FILE_NAME),
                os.path.join(snapshot_path, bash_script_name),
            )
        )

    # hide stuff from the user
    with open(os.path.join(snapshot_path, ".dockerignore"), "w") as docker_ignore:
        docker_ignore.write(".dockerignore\n")
        docker_ignore.write(".orchest\n")
        docker_ignore.write("%s\n" % docker_file_name)

    return {
        "snapshot_path": snapshot_path,
        "base_image": environment_properties["base_image"],
    }


def build_environment_task(task_uuid, project_uuid, environment_uuid, project_path):
    """Function called by the celery task to build an environment.

    Builds an environment (docker image) given the arguments, the logs
    produced by the user provided script are forwarded to a SocketIO
    server and namespace defined in the orchest internals config.

    Args:
        task_uuid:
        project_uuid:
        environment_uuid:
        project_path:

    Returns:

    """
    with requests.sessions.Session() as session:

        try:
            update_environment_build_status("STARTED", session, task_uuid)

            # Prepare the project snapshot with the correctly placed
            # dockerfile, scripts, etc.
            build_context = prepare_build_context(
                task_uuid, project_uuid, environment_uuid, project_path
            )

            # Use the agreed upon pattern for the docker image name.
            docker_image_name = _config.ENVIRONMENT_IMAGE_NAME.format(
                project_uuid=project_uuid, environment_uuid=environment_uuid
            )

            if not os.path.exists(__ENV_BUILD_FULL_LOGS_DIRECTORY):
                os.mkdir(__ENV_BUILD_FULL_LOGS_DIRECTORY)
            # place the logs in the celery container
            complete_logs_path = os.path.join(
                __ENV_BUILD_FULL_LOGS_DIRECTORY, docker_image_name
            )

            status = SioStreamedTask.run(
                # What we are actually running/doing in this task,
                task_lambda=lambda user_logs_fo: build_docker_image(
                    docker_image_name,
                    build_context,
                    task_uuid,
                    user_logs_fo,
                    complete_logs_path,
                ),
                identity=f"{project_uuid}-{environment_uuid}",
                server=_config.ORCHEST_SOCKETIO_SERVER_ADDRESS,
                namespace=_config.ORCHEST_SOCKETIO_ENV_BUILDING_NAMESPACE,
                # note: using task.is_aborted() could be an option but
                # it was giving some issues related to
                # multithreading/processing, moreover, also just passing
                # the task_uuid to this function is less information to
                # rely on, which is good.
                abort_lambda=lambda: AbortableAsyncResult(task_uuid).is_aborted(),
            )

            # cleanup
            os.system('rm -rf "%s"' % build_context["snapshot_path"])

            update_environment_build_status(status, session, task_uuid)

        # Catch all exceptions because we need to make sure to set the
        # build state to failed.
        except Exception as e:
            update_environment_build_status("FAILURE", session, task_uuid)
            raise e
        finally:
            filters = {
                "label": [
                    "_orchest_env_build_is_intermediate=1",
                    f"_orchest_env_build_task_uuid={task_uuid}",
                ]
            }

            # Artifacts of this build (intermediate containers, images,
            # etc.)
            cleanup_env_build_docker_artifacts(filters)

            # See if outdated images of this environment can be cleaned
            # up.
            url = (
                f"{CONFIG_CLASS.ORCHEST_API_ADDRESS}"
                f"/environment-images/dangling/{project_uuid}/{environment_uuid}"
            )
            session.delete(url)

    # The status of the Celery task is SUCCESS since it has finished
    # running. Not related to the actual state of the build, e.g.
    # FAILURE.
    return "SUCCESS"
