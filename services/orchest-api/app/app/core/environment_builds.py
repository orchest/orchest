import json
import os
from datetime import datetime
from typing import Any

import requests
from celery.contrib.abortable import AbortableAsyncResult

from _orchest.internals import config as _config
from app.core.docker_utils import build_docker_image, cleanup_docker_artifacts
from app.core.sio_streamed_task import SioStreamedTask
from config import CONFIG_CLASS

__DOCKERFILE_RESERVED_FLAG = "_ORCHEST_RESERVED_FLAG_"
__ENV_BUILD_FULL_LOGS_DIRECTORY = "/tmp/environment_builds_logs"


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
        f"{environment_build_uuid}"
    )

    with session.put(url, json=data) as response:
        return response.json()


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
    # These labels are coupled with the logic that marks environment
    # images for removal on update and the deletion of said stale
    # images.
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

    # Permission statements.
    ps = [
        "chown -R :$(id -g) . > /dev/null 2>&1 ",
        "find . -type d -exec chmod g+rwxs {} \; > /dev/null 2>&1 ",
        "find . -type f -exec chmod g+rwx {} \; > /dev/null 2>&1 ",
        "chmod g+rwx . > /dev/null 2>&1 ",
    ]
    # sudo'd permission statements.
    sps = ["sudo " + s for s in ps]
    ps = " && ".join(ps)
    sps = " && ".join(sps)
    msg = (
        'The base image must have USER root or "sudo" must be installed, "find" '
        "must also be installed."
    )

    # Note: commands are concatenated with && because this way an
    # exit_code != 0 will bubble up and cause the docker build to fail,
    # as it should. The bash script is removed so that the user won't
    # be able to see it after the build is done.
    rm_statement = (
        f"&& (if [ $(id -u) = 0 ]; then rm {bash_script}; else "
        f"sudo rm {bash_script}; fi)"
    )

    statements.append(
        f'RUN cd "{os.path.join("/", work_dir)}" '
        f'&& echo "{flag}" '
        # The ! in front of echo is there so that the script will fail
        # since the statements in the "if" have failed, the echo is a
        # way of injecting the help message.
        f'&& ((if [ $(id -u) = 0 ]; then {ps}; else {sps}; fi) || ! echo "{msg}") '
        f"&& bash {bash_script} "
        # Needed to inject the rm statement this way, black was
        # introducing an error.
        f'&& echo "{flag}" {rm_statement}'
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
            cleanup_docker_artifacts(filters)

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
