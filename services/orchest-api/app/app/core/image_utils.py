import os
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


def _get_kaniko_base_image_cache_workflow_manifest(
    workflow_name, base_image: str
) -> dict:
    manifest = {
        "apiVersion": "argoproj.io/v1alpha1",
        "kind": "Workflow",
        "metadata": {"name": workflow_name},
        "spec": {
            "entrypoint": "cache-image",
            "templates": [
                {
                    "name": "cache-image",
                    "container": {
                        "name": "kaniko",
                        "image": "gcr.io/kaniko-project/warmer:latest",
                        "args": [
                            f"--image={base_image}",
                            "--cache-dir=/cache",
                            "--verbosity=debug",
                        ],
                        "volumeMounts": [
                            {
                                "name": "image-builder-cache-pvc",
                                "mountPath": "/cache",
                            },
                        ],
                    },
                    "resources": {
                        "requests": {"cpu": _config.USER_CONTAINERS_CPU_SHARES}
                    },
                    "affinity": _registry_pod_affinity,
                },
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
                    "name": "image-builder-cache-pvc",
                    "persistentVolumeClaim": {
                        "claimName": "image-builder-cache-pvc",
                        "readOnly": False,
                    },
                },
            ],
        },
    }
    return manifest


def _get_buildkit_image_build_workflow_manifest(
    workflow_name,
    image_name,
    image_tag,
    build_context_host_path,
    dockerfile_path,
    cache_key: str,
) -> dict:
    """Returns a buildkit workflow manifest given the arguments.

    Args:
        workflow_name: Name with which the workflow will be run.
        image_name: Name of the resulting image, can include repository
            and tags.
        build_context_path: Path on the container where the build
            context is to be found.
        dockerfile_path: Path to the dockerfile, relative to the
            context.
        cache_key: Name of the cache subdirectory of node cache
            directory. Each subdirectory maps to a different cache. Use
            the base_image as the cache_key.

    Returns:
        Valid k8s workflow manifest.
    """
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
                        "name": "buildkitd",
                        "image": CONFIG_CLASS.IMAGE_BUILDER_IMAGE,
                        "command": ["buildctl-daemonless.sh"],
                        "args": [
                            "build",
                            "--frontend",
                            "dockerfile.v0",
                            "--local",
                            "context=/build-context",
                            "--local",
                            "dockerfile=/build-context",
                            "--opt",
                            f"filename={dockerfile_path}",
                            "--export-cache",
                            (
                                f"type=local,mode=max,dest=/cache/{cache_key},"
                                "compression=uncompressed,force-compression=true"
                            ),
                            "--import-cache",
                            f"type=local,src=/cache/{cache_key}",
                            "--output",
                            (
                                "type=image,"
                                "name="
                                f"{_config.REGISTRY_FQDN}/{image_name}:{image_tag},"
                                "push=true"
                            ),
                            # The log setting that includes container
                            # output.
                            "--progress",
                            "plain",
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
                                "mountPath": "/cache",
                            },
                            {
                                "name": "tls-secret",
                                "mountPath": "/etc/ssl/certs/additional-ca-cert-bundle.crt",  # noqa
                                "subPath": "additional-ca-cert-bundle.crt",
                                "readOnly": True,
                            },
                        ],
                    },
                    "resources": {
                        "requests": {"cpu": _config.USER_CONTAINERS_CPU_SHARES}
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


def _get_kaniko_image_build_workflow_manifest(
    workflow_name, image_name, image_tag, build_context_host_path, dockerfile_path
) -> dict:
    """Returns a kaniko workflow manifest given the arguments.

    See _get_buildkit_image_build_workflow_manifest for info about the
    args.
    """
    verbosity = "panic"
    # K8S_TODO: pass this env variable to the celery_worker.
    if os.getenv("FLASK_ENV") == "development":
        verbosity = "info"
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
                            "--context=dir:///build-context",
                            (
                                f"--destination={_config.REGISTRY_FQDN}/{image_name}:"
                                f"{image_tag}"
                            ),
                            "--cleanup",
                            "--log-format=json",
                            "--reproducible",
                            "--cache=true",
                            "--cache-dir=/cache",
                            "--use-new-run",
                            # Note: make sure this runs at least with
                            # kaniko 1.7, see
                            # https://github.com/GoogleContainerTools/kaniko/pull/1735.
                            # Essentially pre 1.7 there are some false
                            # positive cache hits.
                            "--cache-copy-layers",
                            # This allows us to simplify the logging
                            # logic by knowing that kaniko will not
                            # produce logs. If you need to restore the
                            # previous logic look for commit
                            # "Simplify image build logs logic".
                            f"--verbosity={verbosity}",
                            "--snapshotMode=redo",
                            # From the docs: "This flag takes a single
                            # snapshot of the filesystem at the end of
                            # the build, so only one layer will be
                            # appended to the base image."  We use this
                            # flag since we can't cache layers due to
                            # now knowing how aggressive in caching we
                            # can be.
                            "--single-snapshot",
                        ],
                        "volumeMounts": [
                            {
                                "name": "userdir-pvc",
                                "mountPath": "/build-context",
                                "subPath": get_userdir_relpath(build_context_host_path),
                            },
                            {
                                "name": "image-builder-cache-pvc",
                                "mountPath": "/cache",
                                "readOnly": True,
                            },
                            {
                                "name": "tls-secret",
                                "mountPath": "/kaniko/ssl/certs/additional-ca-cert-bundle.crt",  # noqa
                                "subPath": "additional-ca-cert-bundle.crt",
                                "readOnly": True,
                            },
                        ],
                    },
                    "resources": {
                        "requests": {"cpu": _config.USER_CONTAINERS_CPU_SHARES}
                    },
                    "affinity": _registry_pod_affinity,
                },
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
                                # https://github.com/containers/buildah/issues/2741
                                "--format docker "
                                "--force-rm "
                                f"--tag {full_image_name} "
                                # Push
                                f"&& buildah push {full_image_name}"
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
                    "resources": {
                        "requests": {"cpu": _config.USER_CONTAINERS_CPU_SHARES}
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


def _log(user_logs, all_logs, msg, newline=False):
    if newline:
        user_logs.writelines([msg, "\n"])
        all_logs.writelines([msg, "\n"])
    else:
        user_logs.write(msg)
        all_logs.write(msg)
    all_logs.flush()


def _build_image(
    task_uuid,
    image_name,
    image_tag,
    build_context,
    user_logs_file_object,
    complete_logs_file_object,
):
    """Triggers an argo workflow to build an image and follows it."""
    pod_name = f"image-build-task-{task_uuid}"
    manifest = _get_buildah_image_build_workflow_manifest(
        pod_name,
        image_name,
        image_tag,
        build_context["snapshot_path"],
        build_context["dockerfile_path"],
    )

    IS_DEV = os.getenv("FLASK_ENV") == "development"
    if IS_DEV:
        msg = "Running in DEV mode, logs won't be filtered."
        _log(user_logs_file_object, complete_logs_file_object, msg, False)

    msg = "Starting worker...\n"
    _log(user_logs_file_object, complete_logs_file_object, msg, False)
    ns = _config.ORCHEST_NAMESPACE
    k8s_custom_obj_api.create_namespaced_custom_object(
        "argoproj.io", "v1alpha1", ns, "workflows", body=manifest
    )

    utils.wait_for_pod_status(
        pod_name,
        ns,
        expected_statuses=["Running", "Succeeded", "Failed", "Unknown"],
        max_retries=100,
    )

    _log(user_logs_file_object, complete_logs_file_object, "Building image...", False)

    found_base_image_pull_flag = False
    found_copying_flag = False
    copying_regex = re.compile(r"^STEP\s+\d+\/\d+:\s+COPY.*")
    found_userscript_begin_flag = False
    userscript_begin_regex = re.compile(r"^STEP\s+\d+\/\d+:\s+RUN.*")
    has_error = False
    w = watch.Watch()
    for event in w.stream(
        k8s_core_api.read_namespaced_pod_log,
        name=pod_name,
        container="main",
        namespace=ns,
        follow=True,
    ):
        if IS_DEV:
            _log(user_logs_file_object, complete_logs_file_object, event, True)
            continue

        has_error = event.endswith(CONFIG_CLASS.BUILD_IMAGE_ERROR_FLAG)
        if has_error:
            break

        if not (found_base_image_pull_flag and found_copying_flag):
            if not found_base_image_pull_flag and event.startswith("Trying to pull"):
                found_base_image_pull_flag = True
                _log(
                    user_logs_file_object,
                    complete_logs_file_object,
                    "\nPulling base image...",
                    False,
                )
            elif copying_regex.match(event):
                found_base_image_pull_flag = True  # Was already there.
                found_copying_flag = True
                _log(
                    user_logs_file_object,
                    complete_logs_file_object,
                    "\nCopying project...",
                    False,
                )
            # Append a "." to the "Building image..." message.
            else:
                _log(user_logs_file_object, complete_logs_file_object, ".", False)
        elif not found_userscript_begin_flag and userscript_begin_regex.match(event):
            found_userscript_begin_flag = True
            _log(
                user_logs_file_object,
                complete_logs_file_object,
                "\nRunning environment set-up script...",
                True,
            )
        elif found_userscript_begin_flag:
            if event.startswith("--> Using cache"):
                _log(
                    user_logs_file_object,
                    complete_logs_file_object,
                    "\nFound cached layer.",
                    True,
                )
                # Will start storing the image next.
                break
            elif event.endswith(CONFIG_CLASS.BUILD_IMAGE_LOG_FLAG):
                # Will start storing the image next.
                break
            else:
                _log(user_logs_file_object, complete_logs_file_object, event, True)
        # Append a "." to pulling/copying message.
        else:
            _log(user_logs_file_object, complete_logs_file_object, ".", False)

    # The loops exits for 3 reasons: found_ending_flag, found_error_flag
    # or the pod has stopped running.

    resp = k8s_core_api.read_namespaced_pod(name=pod_name, namespace=ns)

    if has_error or resp.status.phase == "Failed":
        msg = (
            "There was a problem building the image. The building script had a non 0 "
            "exit code, build failed.\n"
        )
        _log(user_logs_file_object, complete_logs_file_object, msg, False)
        raise errors.ImageBuildFailedError()
    else:
        msg = "\nStoring image..."
        _log(user_logs_file_object, complete_logs_file_object, msg, False)
        done = False
        while not done:
            try:
                utils.wait_for_pod_status(
                    pod_name,
                    ns,
                    expected_statuses=["Succeeded", "Failed", "Unknown"],
                    max_retries=1,
                )
            except errors.PodNeverReachedExpectedStatusError:
                user_logs_file_object.write(".")
            else:
                user_logs_file_object.write("\n")
                done = True
        msg = "Done!"
        _log(user_logs_file_object, complete_logs_file_object, msg, False)


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
            _build_image(
                task_uuid,
                image_name,
                image_tag,
                build_context,
                user_logs_file_object,
                complete_logs_file_object,
            )
        except (errors.ImageCachingFailedError, errors.ImageBuildFailedError) as e:
            complete_logs_file_object.write(str(e))
            complete_logs_file_object.flush()
            return "FAILURE"

        return "SUCCESS"
