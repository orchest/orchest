import os
from datetime import datetime
from typing import Any

import requests
from celery.contrib.abortable import AbortableAsyncResult
from config import CONFIG_CLASS

from _orchest.internals import config as _config
from app.core.docker_utils import build_docker_image, cleanup_docker_artifacts
from app.core.sio_streamed_task import SioStreamedTask

__DOCKERFILE_RESERVED_FLAG = "_ORCHEST_RESERVED_FLAG_"
__JUPYTER_BUILD_FULL_LOGS_DIRECTORY = "/tmp/jupyter_builds_logs"


def update_jupyter_build_status(
    status: str,
    session: requests.sessions.Session,
    jupyter_build_uuid,
) -> Any:
    """Update Jupyter build status."""
    data = {"status": status}
    if data["status"] == "STARTED":
        data["started_time"] = datetime.utcnow().isoformat()
    elif data["status"] in ["SUCCESS", "FAILURE"]:
        data["finished_time"] = datetime.utcnow().isoformat()

    url = f"{CONFIG_CLASS.ORCHEST_API_ADDRESS}/jupyter-builds/" f"{jupyter_build_uuid}"

    with session.put(url, json=data) as response:
        return response.json()


def write_jupyter_dockerfile(task_uuid, work_dir, bash_script, flag, path):
    """Write a custom dockerfile with the given specifications.

    This dockerfile is built in an ad-hoc way to later be able to only
    log messages related to the user script. Note that the produced
    dockerfile will make it so that the entire context is copied.

    Args:
        task_uuid:
        work_dir: Working directory.
        bash_script: Script to run in a RUN command.
        flag: Flag to use to be able to differentiate between logs of
            the bash_script and logs to be ignored.
        path: Where to save the file.

    Returns:

    """
    statements = []
    statements.append("FROM orchest/jupyter-server:latest")
    # use this to cleanup in case of failure
    statements.append("LABEL _orchest_jupyter_build_is_intermediate=1")
    statements.append(f"LABEL _orchest_jupyter_build_task_uuid={task_uuid}")

    statements.append(f"COPY . \"{os.path.join('/', work_dir)}\"")

    # Note: commands are concatenated with && because this way an
    # exit_code != 0 will bubble up and cause the docker build to fail,
    # as it should. The bash script is removed so that the user won't
    # be able to see it after the build is done.
    statements.append(
        f'RUN cd "{os.path.join("/", work_dir)}" '
        f'&& echo "{flag}" '
        f"&& bash {bash_script} "
        f'&& echo "{flag}" '
        f"&& rm {bash_script}"
    )
    statements.append("LABEL _orchest_jupyter_build_is_intermediate=0")

    statements = "\n".join(statements)

    with open(path, "w") as dockerfile:
        dockerfile.write(statements)


def prepare_build_context(task_uuid):
    """Prepares the docker build context for building the Jupyter image.

    Prepares the docker build context by copying the JupyterLab
    fine tune bash script.

    Args:
        task_uuid:

    Returns:
        Path to the prepared context.

    """
    dockerfile_name = task_uuid
    # the project path we receive is relative to the projects directory
    jupyterlab_setup_script = os.path.join("/userdir", _config.JUPYTER_SETUP_SCRIPT)

    snapshot_path = f"/tmp/{dockerfile_name}"

    if os.path.isdir(snapshot_path):
        os.system('rm -rf "%s"' % snapshot_path)

    os.system('mkdir "%s"' % (snapshot_path))

    bash_script_name = f".{dockerfile_name}.sh"
    write_jupyter_dockerfile(
        task_uuid,
        "tmp/jupyter",
        bash_script_name,
        __DOCKERFILE_RESERVED_FLAG,
        os.path.join(snapshot_path, dockerfile_name),
    )

    if os.path.isfile(jupyterlab_setup_script):
        # move the setup_script to the context
        os.system(
            'cp "%s" "%s"'
            % (
                jupyterlab_setup_script,
                os.path.join(snapshot_path, bash_script_name),
            )
        )
    else:
        # create empty shell script if no setup_script exists
        os.system('touch "%s"' % os.path.join(snapshot_path, bash_script_name))

    return {
        "snapshot_path": snapshot_path,
    }


def build_jupyter_task(task_uuid):
    """Function called by the celery task to build Jupyter image.

    Builds a Jupyter (docker image) given the arguments, the logs
    produced by the user provided script are forwarded to a SocketIO
    server and namespace defined in the orchest internals config.

    Args:
        task_uuid:

    Returns:

    """
    with requests.sessions.Session() as session:

        try:
            update_jupyter_build_status("STARTED", session, task_uuid)

            # Prepare the project snapshot with the correctly placed
            # dockerfile, scripts, etc.
            build_context = prepare_build_context(task_uuid)

            # Use the agreed upon pattern for the docker image name.
            docker_image_name = _config.JUPYTER_IMAGE_NAME.format(
                orchest_version=os.environ.get("ORCHEST_VERSION")
            )

            if not os.path.exists(__JUPYTER_BUILD_FULL_LOGS_DIRECTORY):
                os.mkdir(__JUPYTER_BUILD_FULL_LOGS_DIRECTORY)
            # place the logs in the celery container
            complete_logs_path = os.path.join(
                __JUPYTER_BUILD_FULL_LOGS_DIRECTORY, docker_image_name
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
                identity="jupyter",
                server=_config.ORCHEST_SOCKETIO_SERVER_ADDRESS,
                namespace=_config.ORCHEST_SOCKETIO_JUPYTER_BUILDING_NAMESPACE,
                # note: using task.is_aborted() could be an option but
                # it was giving some issues related to
                # multithreading/processing, moreover, also just passing
                # the task_uuid to this function is less information to
                # rely on, which is good.
                abort_lambda=lambda: AbortableAsyncResult(task_uuid).is_aborted(),
            )

            # cleanup
            os.system('rm -rf "%s"' % build_context["snapshot_path"])

            update_jupyter_build_status(status, session, task_uuid)

        # Catch all exceptions because we need to make sure to set the
        # build state to failed.
        except Exception as e:
            update_jupyter_build_status("FAILURE", session, task_uuid)
            raise e
        finally:
            filters = {
                "label": [
                    "_orchest_jupyter_build_is_intermediate=1",
                    f"_orchest_jupyter_build_task_uuid={task_uuid}",
                ]
            }

            # Artifacts of this build (intermediate containers, images,
            # etc.)
            cleanup_docker_artifacts(filters)

    # The status of the Celery task is SUCCESS since it has finished
    # running. Not related to the actual state of the build, e.g.
    # FAILURE.
    return "SUCCESS"
