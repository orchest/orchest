import os
import re
import time
from pathlib import Path

from flask import current_app
from kubernetes import watch

from _orchest.internals import config as _config
from app import errors, utils
from app.celery_app import make_celery
from app.connections import k8s_core_api, k8s_custom_obj_api
from config import CONFIG_CLASS


def _get_base_image_cache_workflow_manifest(workflow_name, base_image: str) -> dict:
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
                                "name": "kaniko-cache",
                                "mountPath": "/cache",
                            },
                        ],
                    },
                    # K8S_TODO: set to builder node once it exists.
                    "nodeSelector": {"node-role.kubernetes.io/master": ""},
                    "resources": {
                        "requests": {"cpu": _config.USER_CONTAINERS_CPU_SHARES}
                    },
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
                    "name": "kaniko-cache",
                    "hostPath": {
                        "path": CONFIG_CLASS.HOST_KANIKO_BASE_IMAGES_CACHE,
                        "type": "DirectoryOrCreate",
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
        build_context_host_path: Path on the host where the build
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
                        "image": "moby/buildkit:v0.10.0",
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
                                "name": "build-context",
                                "mountPath": "/build-context",
                                "readOnly": True,
                            },
                            {
                                "name": "buildkit-cache",
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
                    # K8S_TODO: set to builder node once it exists.
                    "nodeSelector": {"node-role.kubernetes.io/master": ""},
                    "resources": {
                        "requests": {"cpu": _config.USER_CONTAINERS_CPU_SHARES}
                    },
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
                    "name": "build-context",
                    "hostPath": {
                        "path": build_context_host_path,
                        "type": "DirectoryOrCreate",
                    },
                },
                {
                    "name": "buildkit-cache",
                    "hostPath": {
                        "path": CONFIG_CLASS.HOST_BUILDKIT_CACHE,
                        "type": "DirectoryOrCreate",
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
                            {"name": "build-context", "mountPath": "/build-context"},
                            {
                                "name": "kaniko-cache",
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
                    # K8S_TODO: set to builder node once it exists.
                    "nodeSelector": {"node-role.kubernetes.io/master": ""},
                    "resources": {
                        "requests": {"cpu": _config.USER_CONTAINERS_CPU_SHARES}
                    },
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
                    "name": "build-context",
                    "hostPath": {
                        "path": build_context_host_path,
                        "type": "DirectoryOrCreate",
                    },
                },
                {
                    "name": "kaniko-cache",
                    "hostPath": {
                        "path": CONFIG_CLASS.HOST_KANIKO_BASE_IMAGES_CACHE,
                        "type": "DirectoryOrCreate",
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


def _cache_image(
    task_uuid,
    build_context,
    user_logs_file_object,
    complete_logs_file_object,
):
    """Triggers an argo workflow to cache an image and follows it."""
    base_image = build_context["base_image"]
    msg = f"Looking for base image {base_image}...\n"
    user_logs_file_object.write(msg)
    complete_logs_file_object.write(msg)
    complete_logs_file_object.flush()

    ns = _config.ORCHEST_NAMESPACE
    pod_name = f"image-cache-task-{task_uuid}"
    manifest = _get_base_image_cache_workflow_manifest(pod_name, base_image=base_image)
    k8s_custom_obj_api.create_namespaced_custom_object(
        "argoproj.io", "v1alpha1", ns, "workflows", body=manifest
    )
    utils.wait_for_pod_status(
        pod_name,
        ns,
        expected_statuses=["Running", "Succeeded", "Failed", "Unknown"],
        max_retries=100,
    )
    w = watch.Watch()
    pulled_image = False
    for event in w.stream(
        k8s_core_api.read_namespaced_pod_log,
        name=pod_name,
        container="main",
        namespace=ns,
        follow=True,
    ):

        if "No file found for cache key" in event:
            pulled_image = True
            msg = f"Pulling {base_image}..."
            user_logs_file_object.write(msg)
            complete_logs_file_object.write(msg)
            complete_logs_file_object.flush()
            break

    # Keep writing logs while the image is being pulled for UX.
    if pulled_image:
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
    else:
        msg = f"Found {base_image} locally.\n"
        user_logs_file_object.write(msg)
        complete_logs_file_object.write(msg)
        complete_logs_file_object.flush()

    # The w.stream loop exits once the pod has finished running.
    resp = k8s_core_api.read_namespaced_pod(name=pod_name, namespace=ns)
    if resp.status.phase == "Failed":
        msg = "There was a problem pulling the base image."
        user_logs_file_object.write(msg)
        complete_logs_file_object.write(msg)
        # User logs are not flushed for performance reasons, considering
        # they are sent through socketio as well.
        complete_logs_file_object.flush()
        raise errors.ImageCachingFailedError()


def _log_(user_logs, all_logs, msg, newline=False):
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
    manifest = _get_buildkit_image_build_workflow_manifest(
        pod_name,
        image_name,
        image_tag,
        build_context["snapshot_host_path"],
        build_context["dockerfile_path"],
        cache_key=build_context["base_image"],
    )

    IS_DEV = os.getenv("FLASK_ENV") == "development"
    if IS_DEV:
        msg = "Running in DEV mode, logs won't be filtered."
        _log_(user_logs_file_object, complete_logs_file_object, msg, False)

    msg = "Starting worker...\n"
    _log_(user_logs_file_object, complete_logs_file_object, msg, False)
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

    # Tells us if we can expect base image layers to be in the cache.
    needs_to_pull_base_image = not os.path.exists(
        f'{_config.USERDIR_BUILDKIT_CACHE}/{build_context["base_image"]}/.success.txt'
    )
    if needs_to_pull_base_image:
        msg = "Pulling base image..."
        _log_(user_logs_file_object, complete_logs_file_object, msg, False)

    # Buildkit will add runtimes to commands, can't be deactivated atm.
    runtime_regex = re.compile(r"#\d*\s\d*\.\d*\s")
    flags_count = 0
    found_error_flag = False
    w = watch.Watch()
    # Unfortunately buildkit does not provide a way to only output
    # build logs (i.e. logs from the commands in the dockerfile), see
    # https://github.com/moby/buildkit/issues/2543.
    for event in w.stream(
        k8s_core_api.read_namespaced_pod_log,
        name=pod_name,
        container="main",
        namespace=ns,
        follow=True,
    ):
        if IS_DEV:
            _log_(user_logs_file_object, complete_logs_file_object, event, True)
            continue

        found_error_flag = event.endswith(CONFIG_CLASS.BUILD_IMAGE_ERROR_FLAG)
        if found_error_flag:
            break
        if needs_to_pull_base_image:
            if event.endswith("RUN echo orchest"):
                needs_to_pull_base_image = False
                msg = "\nDone pulling base image."
                _log_(user_logs_file_object, complete_logs_file_object, msg, True)
            else:
                _log_(user_logs_file_object, complete_logs_file_object, ".", False)
                time.sleep(1)
            continue

        if event.startswith("#") and event.endswith("CACHED"):
            msg = "Found cached layer."
            _log_(user_logs_file_object, complete_logs_file_object, msg, True)
            continue
        elif event.endswith(CONFIG_CLASS.BUILD_IMAGE_LOG_FLAG):
            flags_count += 1
            # Build storage has started.
            if flags_count == 2:
                break

            # Don't print the flag.
            continue

        if flags_count == 0:
            continue

        # Remove the runtime from the logs.
        match = runtime_regex.match(event)
        if match:
            event = event[len(match.group()) :]
        _log_(user_logs_file_object, complete_logs_file_object, event, True)

    # The loops exits for 3 reasons: found_ending_flag, found_error_flag
    # or the pod has stopped running.

    resp = k8s_core_api.read_namespaced_pod(name=pod_name, namespace=ns)

    if found_error_flag or resp.status.phase == "Failed":
        msg = (
            "There was a problem building the image. The building script had a non 0 "
            "exit code, build failed.\n"
        )
        _log_(user_logs_file_object, complete_logs_file_object, msg, False)
        raise errors.ImageBuildFailedError()
    else:
        msg = "Storing image..."
        _log_(user_logs_file_object, complete_logs_file_object, msg, False)
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
        # Tells us if we can expect base image layers to be in the
        # cache.
        Path(
            f'{_config.USERDIR_BUILDKIT_CACHE}/{build_context["base_image"]}'
            "/.success.txt"
        ).touch()
        msg = "Done!"
        _log_(user_logs_file_object, complete_logs_file_object, msg, False)


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


def delete_base_images_cache() -> None:
    """Deletes the base images cache through an async celery task.

    The reason for this to be done through a celery-task is that the
    orchest-api doesn't touch the filesystem as a constraint, moreover,
    it provides race condition guarantees w.r.t. env/jupyter builds by
    the fact that the task is put in the "builds" queue, and that the
    concurrency level for builds is 1.
    """
    celery = make_celery(current_app)
    celery.send_task("app.core.tasks.delete_base_images_cache")
