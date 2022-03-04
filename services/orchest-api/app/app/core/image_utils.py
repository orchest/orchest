import os

from flask import current_app
from kubernetes import watch

from _orchest.internals import config as _config
from app import errors, models, utils
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
                        "path": CONFIG_CLASS.BASE_IMAGES_CACHE,
                        "type": "DirectoryOrCreate",
                    },
                },
            ],
        },
    }
    return manifest


def _get_image_build_workflow_manifest(
    workflow_name, image_name, build_context_host_path, dockerfile_path
) -> dict:
    """Returns a workflow manifest given the arguments.

    Args:
        workflow_name: Name with which the workflow will be run.
        image_name: Name of the resulting image, can include repository
            and tags.
        build_context_host_path: Path on the host where the build
            context is to be found.
        dockerfile_path: Path to the dockerfile, relative to the
            context.

    Returns:
        Valid k8s workflow manifest.
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
                            f"--destination={_config.REGISTRY_FQDN}/{image_name}:latest",  # noqa
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
                        "path": CONFIG_CLASS.BASE_IMAGES_CACHE,
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


def _build_image(
    task_uuid,
    image_name,
    build_context,
    user_logs_file_object,
    complete_logs_file_object,
):
    """Triggers an argo workflow to build an image and follows it."""
    pod_name = f"image-build-task-{task_uuid}"
    manifest = _get_image_build_workflow_manifest(
        pod_name,
        image_name,
        build_context["snapshot_host_path"],
        build_context["dockerfile_path"],
    )

    if os.getenv("FLASK_ENV") == "development":
        msg = "Running in DEV mode, kaniko logs won't be filtered."
        user_logs_file_object.write(msg)
        complete_logs_file_object.write(msg)
        complete_logs_file_object.flush()

    msg = "Building image...\n"
    user_logs_file_object.write(msg)
    complete_logs_file_object.write(msg)
    complete_logs_file_object.flush()
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

    found_ending_flag = False
    found_error_flag = False
    w = watch.Watch()
    for event in w.stream(
        k8s_core_api.read_namespaced_pod_log,
        name=pod_name,
        container="main",
        namespace=ns,
        follow=True,
    ):
        found_ending_flag = event.endswith(
            CONFIG_CLASS.BUILD_IMAGE_LOG_TERMINATION_FLAG
        )
        found_error_flag = event.endswith(CONFIG_CLASS.BUILD_IMAGE_ERROR_FLAG)
        # Break here because kaniko is storing the image or the build
        # has failed.
        if found_ending_flag or found_error_flag:
            break

        complete_logs_file_object.writelines([event, "\n"])
        user_logs_file_object.writelines([event, "\n"])
        complete_logs_file_object.flush()
    # The loops exits for 3 reasons: found_ending_flag, found_error_flag
    # or the pod has stopped running.

    # Keep writing logs while the image is being stored for UX.
    if found_ending_flag:
        msg = "Storing image..."
        user_logs_file_object.write(msg)
        complete_logs_file_object.write(msg)
        complete_logs_file_object.flush()
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

    resp = k8s_core_api.read_namespaced_pod(name=pod_name, namespace=ns)

    if found_error_flag or resp.status.phase == "Failed":
        msg = (
            "There was a problem building the image. The building script had a non 0 "
            "exit code, build failed.\n"
        )
        user_logs_file_object.write(msg)
        complete_logs_file_object.write(msg)
        complete_logs_file_object.flush()
        raise errors.ImageBuildFailedError()


def build_image(
    task_uuid,
    image_name,
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
        build_context:
        user_logs_file_object: file object to which logs from the user
            script are written.
        complete_logs_path: path to where to store the full logs are
            written.

    Returns:

    """
    with open(complete_logs_path, "w") as complete_logs_file_object:
        try:
            _cache_image(
                task_uuid,
                build_context,
                user_logs_file_object,
                complete_logs_file_object,
            )

            _build_image(
                task_uuid,
                image_name,
                build_context,
                user_logs_file_object,
                complete_logs_file_object,
            )
        except (errors.ImageCachingFailedError, errors.ImageBuildFailedError) as e:
            complete_logs_file_object.write(e)
            complete_logs_file_object.flush(e)
            return "FAILURE"

        return "SUCCESS"


def is_image_in_use(img_id: str) -> bool:
    return True


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
