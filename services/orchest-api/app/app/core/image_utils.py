import re

from kubernetes import watch

from _orchest.internals import config as _config
from _orchest.internals.utils import get_userdir_relpath
from app import errors, utils
from app.connections import k8s_core_api
from config import CONFIG_CLASS

ORCHEST_LOG_PREFIX = "[Orchest] "


def image_build_task_to_pod_name(task_uuid: str) -> str:
    return f"image-build-task-{task_uuid}"


# Note that both are running with --progress=plain.
_RUNTIME_TO_IMAGE_BUILDER_CMD = {
    "docker": (
        "docker buildx build -f {dockerfile_path} -t {full_image_name} . "
        # See https://github.com/awslabs/amazon-eks-ami/issues/183.
        "--progress=plain --network=host"
    ),
    "containerd": (
        "buildctl build --frontend=dockerfile.v0 --local context=. "
        "--local dockerfile=. --opt filename=./{dockerfile_path} "
        "--progress=plain "
        "--output type=image,name={full_image_name},store=true"
    ),
}
_IMAGE_BUILDER_BUILD_CMD = _RUNTIME_TO_IMAGE_BUILDER_CMD[_config.CONTAINER_RUNTIME]

_RUNTIME_TO_IMAGE_BUILDER_VOLUME_MOUNTS = {
    "docker": [{"name": "docker-socket", "mountPath": "/var/run/docker.sock"}],
    "containerd": [
        {"name": "buildkitd-socket", "mountPath": "/run/buildkit/buildkitd.sock"},
    ],
}

_RUNTIME_TO_IMAGE_BUILDER_VOLUMES = {
    "docker": [
        {
            "name": "docker-socket",
            "path": "/var/run/docker.sock",
            "hostPath": {"path": "/var/run/docker.sock", "type": "Socket"},
        }
    ],
    "containerd": [
        {
            "name": "buildkitd-socket",
            "hostPath": {
                "path": "/run/orchest_buildkit/buildkitd.sock",
                "type": "Socket",
            },
        },
    ],
}

_IMAGE_BUILDER_VOLUME_MOUNTS = _RUNTIME_TO_IMAGE_BUILDER_VOLUME_MOUNTS[
    _config.CONTAINER_RUNTIME
]
_IMAGE_BUILDER_VOLUMES = _RUNTIME_TO_IMAGE_BUILDER_VOLUMES[_config.CONTAINER_RUNTIME]


def _get_image_builder_manifest(
    workflow_name,
    image_name,
    image_tag,
    build_context_host_path,
    dockerfile_path,
) -> dict:
    """Returns the image builder workflow manifest given the arguments.

    Args:
        workflow_name: Name with which the workflow will be run.
        image_name: Name of the resulting image, can include repository
            and tags.
        build_context_path: Path on the container where the build
            context is to be found.
        dockerfile_path: Path to the dockerfile, relative to the
            context.

    Returns:
        Valid k8s workflow manifest.
    """
    reg_ip = utils.get_registry_ip()
    full_image_name = f"{reg_ip}/{image_name}:{image_tag}"
    manifest = {
        "apiVersion": "v1",
        "kind": "Pod",
        "metadata": {"name": workflow_name},
        "spec": {
            "containers": [
                {
                    "name": "image-builder",
                    "image": CONFIG_CLASS.IMAGE_BUILDER_IMAGE,
                    "workingDir": "/build-context",
                    "command": ["/bin/sh", "-c"],
                    "args": [
                        _IMAGE_BUILDER_BUILD_CMD.format(
                            dockerfile_path=dockerfile_path,
                            full_image_name=full_image_name,
                        )
                    ],
                    "securityContext": {
                        "privileged": True,
                    },
                    "volumeMounts": [
                        {
                            "name": "userdir-pvc",
                            "mountPath": "/build-context",
                            "subPath": get_userdir_relpath(build_context_host_path),
                            "readOnly": True,
                        },
                    ]
                    + _IMAGE_BUILDER_VOLUME_MOUNTS,
                },
            ],
            # The celery task actually takes care of deleting the
            # workflow, this is just a failsafe.
            "ttlStrategy": {
                "secondsAfterCompletion": 100,
                "secondsAfterSuccess": 100,
                "secondsAfterFailure": 100,
            },
            "dnsPolicy": "ClusterFirst",
            "restartPolicy": "Never",
            "volumes": [
                {
                    "name": "userdir-pvc",
                    "persistentVolumeClaim": {
                        "claimName": "userdir-pvc",
                    },
                },
            ]
            + _IMAGE_BUILDER_VOLUMES,
        },
    }

    # Some jupyter extensions might require write access to settings
    # during the setup script, e.g. on install. Since buildkit and
    # buildx currently do not support writing to a "bind" volume we let
    # the container write to its local filesystem then rsync the changes
    # over.
    if _config.JUPYTER_IMAGE_NAME in image_name:
        container = manifest["spec"]["containers"][0]
        # Needed to get the existing settings into the build context.
        container["volumeMounts"].append(
            {
                "name": "userdir-pvc",
                "mountPath": "/jupyterlab-user-settings",
                "subPath": ".orchest/user-configurations/jupyterlab/user-settings",
            }
        )
        # Needed because the build takes place in the container runtime,
        # which doesn't have access to the cluster dns.
        container["env"] = container.get("env", []) + [
            {
                "name": "BUILDER_POD_IP",
                "valueFrom": {"fieldRef": {"fieldPath": "status.podIP"}},
            }
        ]

        # To pass the BUILDER_POD_IP env var.
        container["command"] += ["-a"]

        args = container["args"][0]
        # Start the ssh server so that the build container can rsync.
        args = f"/usr/sbin/sshd && {args}"
        # Need to distinguish between buildkit and buildx args passing.
        if _config.CONTAINER_RUNTIME == "containerd":
            args = f"{args} --opt build-arg:BUILDER_POD_IP=$BUILDER_POD_IP"
        elif _config.CONTAINER_RUNTIME == "docker":
            args = f"{args} --build-arg=BUILDER_POD_IP=$BUILDER_POD_IP"
        else:
            raise ValueError()
        container["args"] = [args]

    return manifest


class ImageBuildSidecar:
    """Class to start and follow (log) and image build.

    The class is implemented as a state machine. The only real "state"
    it has are the log files to which to write logs and the current
    state, reflected by self._log_handler_function. Rough schema:

    Starting──►Building───►Copying──┐
    Worker     Image  │    Context  └►Running──────►Storing
                      ▼    ▲          Setup script  Image
                    Pulling│
                    Base Image

    Transitions of the state machine are implemented based on clues
    obtained by the logs of the builder pod. At the moment, this
    implementation works for both the buildkit and buildx based builder.
    Introducing new builder might mean having to implement different
    sidecars to deal with differences in logging behaviour.
    """

    SETUP_SCRIPT_ERROR_MSG = (
        "There was a problem building the image. The building script had a non 0 "
        "exit code, build failed."
    )

    STORAGE_ERROR_MSG = (
        "There was a problem building the image. Failed to push the image."
    )

    def __init__(
        self,
        task_uuid,
        image_name,
        image_tag,
        build_context,
        user_logs_file_object,
        complete_logs_file_object,
    ):
        self.task_uuid = task_uuid
        self.image_name = image_name
        self.image_tag = image_tag
        self.build_context = build_context
        self.user_logs_file_object = user_logs_file_object
        self.complete_logs_file_object = complete_logs_file_object
        self.pulling_regex = re.compile(r"^\s*#\d+\s*sha256:")
        self.copying_regex = re.compile(r"^\s*#\d+\s*\[\s*\d+\/\d+\s*\]\s*COPY.*")
        self.userscript_begin_regex = re.compile(
            r"^\s*#\d+\s*\[\s*\d+\/\d+\s*\]\s*RUN.*"
        )
        self.setup_script_cached_regex = re.compile(r"^\s*#\d+\s*CACHED")

    def start(self) -> None:

        pod_name = self._start_build_pod(
            self.task_uuid, self.image_name, self.image_tag, self.build_context
        )

        self._log(utils.wrap_ansi_grey(ORCHEST_LOG_PREFIX + "Starting image build..."))
        self.log_handler_function = self._log_starting_build_phase
        w = watch.Watch()
        for event in w.stream(
            k8s_core_api.read_namespaced_pod_log,
            name=pod_name,
            namespace=_config.ORCHEST_NAMESPACE,
            follow=True,
        ):
            if event.endswith(CONFIG_CLASS.BUILD_IMAGE_ERROR_FLAG):
                self._log(ImageBuildSidecar.SETUP_SCRIPT_ERROR_MSG)
                raise errors.ImageBuildFailedError()

            should_break = self.log_handler_function(event)
            if should_break:
                break

        # The loops exits for 3 reasons: found_ending_flag,
        # found_error_flag or the pod has stopped running. However, we
        # have noticed a race condition where the loop could exit
        # without the pod and container state reflecting that.
        self._check_for_errors_at_pod_level(
            pod_name, ImageBuildSidecar.SETUP_SCRIPT_ERROR_MSG
        )
        self._log_storage_phase(pod_name)

    def _check_for_errors_at_pod_level(self, pod_name: str, error_msg: str) -> None:
        resp = k8s_core_api.read_namespaced_pod(
            name=pod_name, namespace=_config.ORCHEST_NAMESPACE
        )
        resp_status = resp.status.to_dict()

        exit_code = None
        for status in resp_status.get("container_statuses", []):
            terminated_status = status.get("state", {}).get("terminated")
            # It can be set to None.
            if terminated_status is None:
                continue
            exit_code = terminated_status.get("exit_code")
            if exit_code is not None:
                break

        if (exit_code is not None and exit_code != 0) or resp_status.get(
            "phase"
        ) == "Failed":
            self._log(error_msg)
            raise errors.ImageBuildFailedError()

    def _start_build_pod(
        self,
        task_uuid,
        image_name,
        image_tag,
        build_context,
    ) -> str:
        pod_name = image_build_task_to_pod_name(task_uuid)
        manifest = _get_image_builder_manifest(
            pod_name,
            image_name,
            image_tag,
            build_context["snapshot_path"],
            build_context["dockerfile_path"],
        )

        msg = utils.wrap_ansi_grey(ORCHEST_LOG_PREFIX + "Starting worker...\n")
        self._log(msg, False)
        ns = _config.ORCHEST_NAMESPACE
        k8s_core_api.create_namespaced_pod(ns, body=manifest)
        utils.wait_for_pod_status(
            pod_name,
            ns,
            expected_statuses=["Running", "Succeeded", "Failed", "Unknown"],
            max_retries=2000,
        )
        return pod_name

    def _log_starting_build_phase(self, event: str) -> None:
        if self.pulling_regex.match(event):
            self._log(
                utils.wrap_ansi_grey(
                    "\n" + ORCHEST_LOG_PREFIX + "Pulling base image..."
                ),
                False,
            )
            self.log_handler_function = self._log_base_image_pull_phase
        elif self.copying_regex.match(event):
            self._log(
                utils.wrap_ansi_grey("\n" + ORCHEST_LOG_PREFIX + "Copying context..."),
                False,
            )
            self.log_handler_function = self._log_copy_context_phase
        else:
            self._log(utils.wrap_ansi_grey("."))

    def _log_storage_phase(self, pod_name: str) -> None:
        self._log(utils.wrap_ansi_grey(ORCHEST_LOG_PREFIX + "Storing image..."))
        done = False
        while not done:
            try:
                utils.wait_for_pod_status(
                    pod_name,
                    _config.ORCHEST_NAMESPACE,
                    expected_statuses=["Succeeded", "Failed", "Unknown"],
                    max_retries=1,
                )
            except errors.PodNeverReachedExpectedStatusError:
                self._log(utils.wrap_ansi_grey("."))
            else:
                self._log("\n")
                done = True
        self._check_for_errors_at_pod_level(
            pod_name, ImageBuildSidecar.STORAGE_ERROR_MSG
        )
        msg = utils.wrap_ansi_grey(ORCHEST_LOG_PREFIX + "Done!")
        self._log(msg)

    def _log_base_image_pull_phase(self, event: str) -> bool:
        if self.copying_regex.match(event):
            # Is done pulling and has started copying the context.
            self.log_handler_function = self._log_copy_context_phase
            self._log(
                utils.wrap_ansi_grey("\n" + ORCHEST_LOG_PREFIX + "Copying context...")
            )
        else:
            # Append to "Pulling base image..."
            self._log(".")
        return False

    def _log_copy_context_phase(self, event: str) -> bool:
        if self.userscript_begin_regex.match(event):
            # Is done copying, has started running the set-up script.
            self._log(
                utils.wrap_ansi_grey(
                    "\n" + ORCHEST_LOG_PREFIX + "Running environment set-up script..."
                ),
                True,
            )
            self.log_handler_function = self._log_setup_script_phase
        else:
            # Append to "Copying context..."
            self._log(utils.wrap_ansi_grey("."))
        return False

    def _log_setup_script_phase(self, event: str) -> None:
        if self.setup_script_cached_regex.match(event):
            self._log(
                utils.wrap_ansi_grey(ORCHEST_LOG_PREFIX + "Found cached layer."), True
            )
            # Will start storing the image next.
            return True
        elif event.endswith(CONFIG_CLASS.BUILD_IMAGE_LOG_FLAG):
            # Will start storing the image next.
            return True
        else:
            # A 'echo "hello"' in the setup script would produce a line
            # like the following:
            # '#8 0.514 hello'
            # For performance reasons we make use of the fact that there
            # are exactly 2 spaces before the real log to filter out
            # unwanted text in a way that doesn't hit performance too
            # much.
            iterator = re.finditer("\s", event)
            next(iterator)
            match = next(iterator)
            self._log(event[match.end() :], True)
        return False

    def _log(self, msg, newline=False):
        if newline:
            self.user_logs_file_object.writelines([msg, "\n"])
            self.complete_logs_file_object.writelines([msg, "\n"])
        else:
            self.user_logs_file_object.writelines(msg)
            self.complete_logs_file_object.writelines(msg)
        self.complete_logs_file_object.flush()


def build_image(
    task_uuid,
    image_name,
    image_tag,
    build_context,
    user_logs_file_object,
    complete_logs_path,
):
    """Builds an image with the given tag, context_path and docker file.

    The image build is done through the creation of a k8s argo workflow
    name "image-build-task-{task_uuid}" to be deleted by the caller of
    this function.

    Args:
        task_uuid:
        image_name:
        image_tag:
        build_context:
        user_logs_file_object: file object to which logs from the user
            script are written.
        complete_logs_path: path to where to store the full logs are
            written.

    Returns:

    """
    with open(complete_logs_path, "w") as complete_logs_file_object:
        try:
            ImageBuildSidecar(
                task_uuid,
                image_name,
                image_tag,
                build_context,
                user_logs_file_object,
                complete_logs_file_object,
            ).start()
        except (errors.ImageCachingFailedError, errors.ImageBuildFailedError) as e:
            complete_logs_file_object.write(str(e))
            complete_logs_file_object.flush()
            return "FAILURE"

        return "SUCCESS"
