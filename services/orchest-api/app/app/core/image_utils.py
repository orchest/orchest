import re

from kubernetes import watch

from _orchest.internals import config as _config
from _orchest.internals.utils import get_userdir_relpath
from app import errors, utils
from app.connections import k8s_core_api, k8s_custom_obj_api
from config import CONFIG_CLASS

# This way the builder pod is always scheduled on the same node as the
# registry to have quicker pushes. Moreover, the fact that the builder
# pod always runs on the same node allow us to make use of on disk cache
# for layers, which is mounted as a volume.
_registry_pod_affinity = {
    "podAffinity": {
        "requiredDuringSchedulingIgnoredDuringExecution": [
            {
                "labelSelector": {
                    "matchExpressions": [
                        {
                            "key": "app",
                            "operator": "In",
                            "values": ["docker-registry"],
                        }
                    ]
                },
                "topologyKey": "kubernetes.io/hostname",
            }
        ]
    }
}


def image_build_task_to_pod_name(task_uuid: str) -> str:
    return f"image-build-task-{task_uuid}"


def _get_buildah_image_build_workflow_manifest(
    workflow_name,
    image_name,
    image_tag,
    build_context_host_path,
    dockerfile_path,
) -> dict:
    """Returns a buildah workflow manifest given the arguments.

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
        "apiVersion": "argoproj.io/v1alpha1",
        "kind": "Workflow",
        "metadata": {"name": workflow_name},
        "spec": {
            "entrypoint": "build-env",
            "templates": [
                {
                    "name": "build-env",
                    "container": {
                        "name": "buildah",
                        "image": "docker",
                        "workingDir": "/build-context",
                        "command": ["/bin/sh", "-c"],
                        "args": [
                            (
                                f"docker build -f {dockerfile_path} "
                                f"-t {full_image_name} /build-context"
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
                            {"name": "dockersock", "mountPath": "/var/run/docker.sock"},
                        ],
                    },
                    "affinity": _registry_pod_affinity,
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
            # MULTITENANCY_TODO: different users should have different
            # pvcs?
            "volumes": [
                {
                    "name": "userdir-pvc",
                    "persistentVolumeClaim": {
                        "claimName": "userdir-pvc",
                    },
                },
                {
                    "name": "dockersock",
                    "path": "/var/run/docker.sock",
                    "hostPath": {"path": "/var/run/docker.sock", "type": "Socket"},
                },
            ],
        },
    }

    # Mount docker.sock to pull from local docker daemon to enable
    # pulling base images of the form docker-daemon:<image>.
    if CONFIG_CLASS.DEV_MODE:
        manifest["spec"]["volumes"].append(
            {
                "name": "dockersock",
                "hostPath": {"path": "/var/run/docker.sock", "type": ""},
            }
        )
        container = manifest["spec"]["templates"][0]["container"]
        container["volumeMounts"].append(
            {"name": "dockersock", "mountPath": "/var/run/docker.sock"}
        )
        container["args"][0] = container["args"][0].replace(
            "buildah build",
            # Check if there is a newer image, if so, pull it.
            "buildah build --pull=true",
        )

    # For extensions that need access to the settings on install.
    if _config.JUPYTER_IMAGE_NAME in image_name:
        container = manifest["spec"]["templates"][0]["container"]
        container["volumeMounts"].append(
            {
                "name": "userdir-pvc",
                "mountPath": "/jupyterlab-user-settings",
                "subPath": ".orchest/user-configurations/jupyterlab/user-settings",
            }
        )
        container["args"][0] = container["args"][0].replace(
            "buildah build",
            (
                "buildah build -v "
                "/jupyterlab-user-settings:/root/.jupyter/lab/user-settings "
            ),
        )

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
        self.copying_regex = re.compile(r"^STEP\s+\d+\/\d+:\s+COPY.*")
        self.userscript_begin_regex = re.compile(r"^STEP\s+\d+\/\d+:\s+RUN.*")

    def start(self) -> None:

        pod_name = self._start_build_pod(
            self.task_uuid, self.image_name, self.image_tag, self.build_context
        )

        self._log("Starting image build...")
        self.log_handler_function = self._log_starting_build_phase
        w = watch.Watch()
        for event in w.stream(
            k8s_core_api.read_namespaced_pod_log,
            name=pod_name,
            container="main",
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
        manifest = _get_buildah_image_build_workflow_manifest(
            pod_name,
            image_name,
            image_tag,
            build_context["snapshot_path"],
            build_context["dockerfile_path"],
        )

        msg = "Starting worker...\n"
        self._log(msg, False)
        ns = _config.ORCHEST_NAMESPACE
        k8s_custom_obj_api.create_namespaced_custom_object(
            "argoproj.io", "v1alpha1", ns, "workflows", body=manifest
        )
        utils.wait_for_pod_status(
            pod_name,
            ns,
            expected_statuses=["Running", "Succeeded", "Failed", "Unknown"],
            max_retries=2000,
        )
        return pod_name

    def _log_starting_build_phase(self, event: str) -> None:
        if event.startswith("Trying to pull"):
            self._log("\nPulling base image...", False)
            self.log_handler_function = self._log_base_image_pull_phase
        elif self.copying_regex.match(event):
            self._log("\nCopying context...", False)
            self.log_handler_function = self._log_copy_context_phase
        else:
            # Append to "Building image..."
            self._log(".")

    def _log_storage_phase(self, pod_name: str) -> None:
        self._log("Storing image...")
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
                self._log(".")
            else:
                self._log("\n")
                done = True
        self._check_for_errors_at_pod_level(
            pod_name, ImageBuildSidecar.STORAGE_ERROR_MSG
        )
        msg = "Done!"
        self._log(msg)

    def _log_base_image_pull_phase(self, event: str) -> bool:
        if self.copying_regex.match(event):
            # Is done pulling and has started copying the context.
            self.log_handler_function = self._log_copy_context_phase
            self._log("\nCopying context...")
        else:
            # Append to "Pulling base image..."
            self._log(".")
        return False

    def _log_copy_context_phase(self, event: str) -> bool:
        if self.userscript_begin_regex.match(event):
            # Is done copying, has started running the set-up script.
            self._log("\nRunning environment set-up script...", True)
            self.log_handler_function = self._log_setup_script_phase
        else:
            # Append to "Copying context..."
            self._log(".")
        return False

    def _log_setup_script_phase(self, event: str) -> None:
        if event.startswith("--> Using cache"):
            self._log("Found cached layer.", True)
            # Will start storing the image next.
            return True
        elif event.endswith(CONFIG_CLASS.BUILD_IMAGE_LOG_FLAG):
            # Will start storing the image next.
            return True
        else:
            self._log(event, True)
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
