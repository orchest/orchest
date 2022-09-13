import os
from datetime import datetime
from typing import Any, Optional

import requests
from celery.contrib.abortable import AbortableAsyncResult

from _orchest.internals import config as _config
from _orchest.internals.utils import copytree, rmtree
from app.connections import k8s_core_api
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


def write_jupyter_dockerfile(base_image, task_uuid, work_dir, bash_script, path):
    """Write a custom dockerfile with the given specifications.

    ! The dockerfile is written in a way that the layer where the user
    setup script is run is effectively cached when possible, i.e.  we
    don't disrupt the caching capability by using task dependent
    information like the task_uuid in that layer. We make use of the
    task_uuid in a layer that is created at the end so that each image
    has a unique digest, which helps reducing complexity when it comes
    to deleting images from the registry.

    This dockerfile is built in an ad-hoc way to later be able to only
    log messages related to the user script. Note that the produced
    dockerfile will make it so that the entire context is copied.

    Args:
        work_dir: Working directory.
        task_uuid: Used to create a layer that is unique for this
            particular image, this way the registry digest of the image
            will be unique.
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
    statements.append("ARG BUILDER_POD_IP")
    statements.append("ENV BUILDER_POD_IP=${BUILDER_POD_IP}")
    statements.append(f'WORKDIR {os.path.join("/", work_dir)}')

    statements.append("COPY . .")

    # Note: commands are concatenated with && because this way an
    # exit_code != 0 will bubble up and cause the build to fail, as it
    # should. The bash script is removed so that the user won't be able
    # to see it after the build is done.
    flag = CONFIG_CLASS.BUILD_IMAGE_LOG_FLAG
    error_flag = CONFIG_CLASS.BUILD_IMAGE_ERROR_FLAG

    ssh_options = (
        'ssh -o "StrictHostKeyChecking=no" '
        '-o "ServerAliveInterval=30" '
        '-o "ServerAliveCountMax=30" '
        '-o "UserKnownHostsFile=/dev/null" '
    )
    # This is needed to rsync settings to the userdir since buildkit
    # does not support writing to "bind" volumes.
    rsync_jupyter_settings_command = (
        f"sshpass -p 'root' rsync -v -e '{ssh_options}' "
        f"-rlP /root/.jupyter/lab/user-settings/ "
        f"root@$BUILDER_POD_IP:/jupyterlab-user-settings/"
    )

    statements.append(
        # To make user settings available to extensions that require it.
        "RUN mkdir /root/.jupyter/lab -p "
        "&& rm /root/.jupyter/lab/user-settings -rf "
        "&& mv _orchest_configurations_jupyterlab_user_settings "
        "/root/.jupyter/lab/user-settings "
        # Run the user script.
        f"&& bash < {bash_script} "
        # Other internal commands.
        "&& build_path_ext=/jupyterlab-orchest-build/extensions "
        "&& userdir_path_ext=/usr/local/share/jupyter/lab/extensions "
        "&& if [ -d $userdir_path_ext ] && [ -d $build_path_ext ]; then "
        "cp -rfT $userdir_path_ext $build_path_ext &> /dev/null ; fi "
        f"&& echo {flag} "
        f"&& rm {bash_script} "
        f"&& {rsync_jupyter_settings_command}"
        # The || <error flag> allows to avoid builder errors logs making
        # into it the user logs and tell us that there has been an
        # error.
        f"|| (echo {error_flag} && PRODUCE_AN_ERROR)"
    )

    # Set the WORKDIR back to project-dir, so that terminals created
    # through jupyter server have said WORKDIR, and extensions can rely
    # on the process WORKDIR being the project directory.
    statements.append("WORKDIR /project-dir")

    # Make it so that the digest of the produced image is unique.
    statements.append(
        f"RUN mkdir -p /orchest && echo '{task_uuid}' > /orchest/task_{task_uuid}.txt"
    )
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

    # Copy the settings into the context to make them available during
    # build. It's done in this "simple" manner to be compatible with all
    # container runtimes we use to build. This is done for extensions
    # that need access to (READ) the settings on install. Writes are
    # currently not supported since both buildkit and buildx do not
    # support binding a writable directory.
    copytree(
        "/userdir/.orchest/user-configurations/jupyterlab/user-settings",
        os.path.join(snapshot_path, "_orchest_configurations_jupyterlab_user_settings"),
    )

    write_jupyter_dockerfile(
        base_image,
        task_uuid,
        "tmp/jupyter",
        bash_script_name,
        os.path.join(snapshot_path, dockerfile_name),
    )
    with open(os.path.join(snapshot_path, ".dockerignore"), "w") as docker_ignore:
        docker_ignore.write(".dockerignore\n")
        docker_ignore.write(f"{dockerfile_name}\n")

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
            # The task was successful or aborted, cleanup the pod.
            k8s_core_api.delete_namespaced_pod(
                image_utils.image_build_task_to_pod_name(task_uuid),
                _config.ORCHEST_NAMESPACE,
            )

    # The status of the Celery task is SUCCESS since it has finished
    # running. Not related to the actual state of the build, e.g.
    # FAILURE.
    return "SUCCESS"
