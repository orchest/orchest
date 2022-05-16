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
    full_image_name = f"{_config.REGISTRY_FQDN}/{image_name}:{image_tag}"
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
                        "image": CONFIG_CLASS.IMAGE_BUILDER_IMAGE,
                        "workingDir": "/build-context",
                        "command": ["/bin/sh", "-c"],
                        "args": [
                            (
                                # Build
                                f"buildah build -f {dockerfile_path} --layers=true "
                                # Package managers caches.
                                # jovyan is the user of the base image.
                                "-v /pip-cache:/home/jovyan/.cache/pip "
                                # Obtained by running "conda info". Note
                                # that this cache is also used by mamba.
                                "-v /conda-cache:/opt/conda/pkgs "
                                # https://github.com/containers/buildah/issues/2741
                                "--format docker "
                                "--force-rm=true "
                                "--disable-compression=true "
                                # Avoid a warning about not being able
                                # to write to the audit log.
                                "--cap-add=CAP_AUDIT_WRITE "
                                f"--tag {full_image_name} "
                                # Push
                                "&& buildah push "
                                "--disable-compression=true "
                                # Buildah might compress regardless of
                                # the specified options depending on the
                                # destination storage, tune such
                                # compression.
                                "--compression-format=zstd:chunked "
                                "--compression-level=0 "
                                f"{full_image_name}"
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
                            {
                                "name": "image-builder-cache-pvc",
                                "subPath": "pip-cache",
                                "mountPath": "/pip-cache",
                            },
                            {
                                "name": "image-builder-cache-pvc",
                                "subPath": "conda-cache",
                                "mountPath": "/conda-cache",
                            },
                            {
                                "name": "image-builder-cache-pvc",
                                "subPath": "containers",
                                "mountPath": "/var/lib/containers",
                            },
                            {
                                "name": "tls-secret",
                                "mountPath": "/etc/ssl/certs/additional-ca-cert-bundle.crt",  # noqa
                                "subPath": "additional-ca-cert-bundle.crt",
                                "readOnly": True,
                            },
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
                    "name": "image-builder-cache-pvc",
                    "persistentVolumeClaim": {
                        "claimName": "image-builder-cache-pvc",
                    },
                },
                {
                    "name": "tls-secret",
                    "secret": {
                        "secretName": "registry-tls-secret",
                        "items": [
                            {"key": "ca.crt", "path": "additional-ca-cert-bundle.crt"}
                        ],
                    },
                },
            ],
        },
    }
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
                self._handle_error()

            should_break = self.log_handler_function(event)
            if should_break:
                break

        # The loops exits for 3 reasons: found_ending_flag,
        # found_error_flag or the pod has stopped running.
        resp = k8s_core_api.read_namespaced_pod(
            name=pod_name, namespace=_config.ORCHEST_NAMESPACE
        )
        if resp.status.phase == "Failed":
            self._handle_error()
        else:
            self._log_storage_phase(pod_name)

    def _start_build_pod(
        self,
        task_uuid,
        image_name,
        image_tag,
        build_context,
    ) -> str:
        pod_name = f"image-build-task-{task_uuid}"
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

    def _handle_error(self) -> None:
        msg = (
            "There was a problem building the image. The building script had a non 0 "
            "exit code, build failed."
        )
        self._log(msg)
        raise errors.ImageBuildFailedError()

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

    The image build is done through the creation of k8s argo workflows,
    which needs to be deleted by the caller, the workflows are named as
    "image-cache-task-{task_uuid}" and "image-build-task-{task_uuid}".

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
