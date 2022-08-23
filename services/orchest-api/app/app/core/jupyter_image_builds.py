import os
from datetime import datetime
from typing import Any, Optional

import requests
from celery.contrib.abortable import AbortableAsyncResult

from _orchest.internals import config as _config
from _orchest.internals.utils import rmtree
from app.connections import k8s_core_api, k8s_custom_obj_api
from app.core import image_utils
from app.core.sio_streamed_task import SioStreamedTask
from app.utils import get_logger
from config import CONFIG_CLASS

logger = get_logger()

__JUPYTER_BUILD_FULL_LOGS_DIRECTORY = "/tmp/jupyter_image_builds_logs"


def update_jupyter_image_build_status(
    session: requests.sessions.Session,
    jupyter_image_build_uuid: str,
    status: str,
    cluster_node: Optional[str] = None,
) -> Any:
    """Update Jupyter build status."""
    data = {"status": status}
    if cluster_node is not None:
        data["cluster_node"] = cluster_node

    if data["status"] == "STARTED":
        data["started_time"] = datetime.utcnow().isoformat()
    elif data["status"] in ["SUCCESS", "FAILURE"]:
        data["finished_time"] = datetime.utcnow().isoformat()

    url = (
        f"{CONFIG_CLASS.ORCHEST_API_ADDRESS}/jupyter-builds/"
        f"{jupyter_image_build_uuid}"
    )

    with session.put(url, json=data) as response:
        return response.json()


def write_jupyter_dockerfile(base_image, work_dir, bash_script, path):
    """Write a custom dockerfile with the given specifications.

    This dockerfile is built in an ad-hoc way to later be able to only
    log messages related to the user script. Note that the produced
    dockerfile will make it so that the entire context is copied.

    Args:
        work_dir: Working directory.
        bash_script: Script to run in a RUN command.
        path: Where to save the file.

    Returns:
        Dictionary containing build context details.

    """
    statements = []

    custom_registry_prefix = "registry:"
    if base_image.startswith(custom_registry_prefix):
        full_basename = base_image[len(custom_registry_prefix) :]
    else:
        full_basename = f"docker.io/{base_image}"

    statements.append(f"FROM {full_basename}")
    statements.append(f'WORKDIR {os.path.join("/", work_dir)}')

    statements.append("COPY . .")

    # Note: commands are concatenated with && because this way an
    # exit_code != 0 will bubble up and cause the build to fail, as it
    # should. The bash script is removed so that the user won't be able
    # to see it after the build is done.
    flag = CONFIG_CLASS.BUILD_IMAGE_LOG_FLAG
    error_flag = CONFIG_CLASS.BUILD_IMAGE_ERROR_FLAG
    statements.append(
        f"RUN bash < {bash_script} "
        "&& build_path_ext=/jupyterlab-orchest-build/extensions "
        "&& userdir_path_ext=/usr/local/share/jupyter/lab/extensions "
        "&& if [ -d $userdir_path_ext ] && [ -d $build_path_ext ]; then "
        "cp -rfT $userdir_path_ext $build_path_ext &> /dev/null ; fi "
        f"&& echo {flag} "
        f"&& rm {bash_script} "
        # The || <error flag> allows to avoid builder errors logs making
        # into it the user logs and tell us that there has been an
        # error.
        f"|| (echo {error_flag} && PRODUCE_AN_ERROR)"
    )

    # Set the WORKDIR back to project-dir, so that terminals created
    # through jupyter server have said WORKDIR, and extensions can rely
    # on the process WORKDIR being the project directory.
    statements.append("WORKDIR /project-dir")

    statements = "\n".join(statements)

    with open(path, "w") as dockerfile:
        dockerfile.write(statements)


def prepare_build_context(task_uuid):
    """Prepares the build context for building the Jupyter image.

    Prepares the build context by copying the JupyterLab fine tune bash
    script.

    Args:
        task_uuid:

    Returns:
        Path to the prepared context.

    """
    # The project path we receive is relative to the projects directory.
    jupyterlab_setup_script = os.path.join("/userdir", _config.JUPYTER_SETUP_SCRIPT)
    jupyter_image_builds_dir = _config.USERDIR_JUPYTER_IMG_BUILDS
    snapshot_path = f"{jupyter_image_builds_dir}/{task_uuid}"

    if os.path.isdir(snapshot_path):
        rmtree(snapshot_path)

    os.system('mkdir "%s"' % (snapshot_path))

    dockerfile_name = ".orchest-reserved-jupyter-dockerfile"
    bash_script_name = ".orchest-reserved-jupyter-setup.sh"

    snapshot_setup_script_path = os.path.join(snapshot_path, bash_script_name)
    if os.path.isfile(jupyterlab_setup_script):
        # Move the setup_script to the context.
        os.system(
            'cp "%s" "%s"' % (jupyterlab_setup_script, snapshot_setup_script_path)
        )
    else:
        # Create empty shell script if no setup_script exists.
        os.system(f'touch "{snapshot_setup_script_path}"')

    base_image = f"orchest/jupyter-server:{CONFIG_CLASS.ORCHEST_VERSION}"
    if CONFIG_CLASS.DEV_MODE:
        # Use image from local daemon if instructed to do so.
        with open(snapshot_setup_script_path, "r") as script_file:
            first_line = script_file.readline()
            if "# LOCAL IMAGE" in first_line:
                base_image = f"registry:docker-daemon:{base_image}"
                logger.info(f"Using {base_image}.")

    write_jupyter_dockerfile(
        base_image,
        "tmp/jupyter",
        bash_script_name,
        os.path.join(snapshot_path, dockerfile_name),
    )

    res = {
        "snapshot_path": snapshot_path,
        "base_image": base_image,
        "dockerfile_path": dockerfile_name,
    }

    return res


def build_jupyter_image_task(task_uuid: str, image_tag: str):
    """Function called by the celery task to build Jupyter image.

    Builds a Jupyter image given the arguments, the logs produced by the
    user provided script are forwarded to a SocketIO server and
    namespace defined in the orchest internals config.

    Args:
        task_uuid:
        image_tag:

    Returns:

    """
    with requests.sessions.Session() as session:

        try:
            update_jupyter_image_build_status(session, task_uuid, "STARTED")

            # Prepare the project snapshot with the correctly placed
            # dockerfile, scripts, etc.
            build_context = prepare_build_context(task_uuid)

            # Use the agreed upon pattern for the image name.
            image_name = _config.JUPYTER_IMAGE_NAME

            if not os.path.exists(__JUPYTER_BUILD_FULL_LOGS_DIRECTORY):
                os.mkdir(__JUPYTER_BUILD_FULL_LOGS_DIRECTORY)
            # place the logs in the celery container
            complete_logs_path = os.path.join(
                __JUPYTER_BUILD_FULL_LOGS_DIRECTORY, image_name
            )

            status = SioStreamedTask.run(
                # What we are actually running/doing in this task,
                task_lambda=lambda user_logs_fo: image_utils.build_image(
                    task_uuid,
                    image_name,
                    image_tag,
                    build_context,
                    user_logs_fo,
                    complete_logs_path,
                ),
                identity="jupyter",
                server=_config.ORCHEST_SOCKETIO_SERVER_ADDRESS,
                namespace=_config.ORCHEST_SOCKETIO_JUPYTER_IMG_BUILDING_NAMESPACE,
                # note: using task.is_aborted() could be an option but
                # it was giving some issues related to
                # multithreading/processing, moreover, also just passing
                # the task_uuid to this function is less information to
                # rely on, which is good.
                abort_lambda=lambda: AbortableAsyncResult(task_uuid).is_aborted(),
            )

            # cleanup
            rmtree(build_context["snapshot_path"])

            pod_name = image_utils.image_build_task_to_pod_name(task_uuid)
            pod = k8s_core_api.read_namespaced_pod(
                name=pod_name, namespace=_config.ORCHEST_NAMESPACE
            )
            update_jupyter_image_build_status(
                session, task_uuid, status, pod.spec.node_name
            )

        # Catch all exceptions because we need to make sure to set the
        # build state to failed.
        except Exception as e:
            update_jupyter_image_build_status(session, task_uuid, "FAILURE")
            logger.error(e)
            raise e
        finally:
            # We get here either because the task was successful or was
            # aborted, in any case, delete the workflow.
            k8s_custom_obj_api.delete_namespaced_custom_object(
                "argoproj.io",
                "v1alpha1",
                _config.ORCHEST_NAMESPACE,
                "workflows",
                image_utils.image_build_task_to_pod_name(task_uuid),
            )

    # The status of the Celery task is SUCCESS since it has finished
    # running. Not related to the actual state of the build, e.g.
    # FAILURE.
    return "SUCCESS"
