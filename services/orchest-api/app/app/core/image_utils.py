import logging
import os
import time
from typing import Optional

from flask import current_app
from kubernetes import watch

from _orchest.internals import config as _config
from _orchest.internals.utils import docker_images_list_safe, docker_images_rm_safe
from app import errors, models, utils
from app.connections import docker_client, k8s_core_api, k8s_custom_obj_api

__DOCKERFILE_RESERVED_FLAG = "_ORCHEST_RESERVED_FLAG_"
__DOCKERFILE_RESERVED_ERROR_FLAG = "_ORCHEST_RESERVED_ERROR_FLAG_"


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
                    "securityContext": {
                        "runAsUser": 0,
                        "runAsGroup": int(os.environ.get("ORCHEST_HOST_GID")),
                        "fsGroup": int(os.environ.get("ORCHEST_HOST_GID")),
                    },
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
                        "path": "/tmp/kaniko/cache",
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
    manifest = {
        "apiVersion": "argoproj.io/v1alpha1",
        "kind": "Workflow",
        "metadata": {"name": workflow_name},
        "spec": {
            "entrypoint": "build-env",
            "templates": [
                {
                    "name": "build-env",
                    "securityContext": {
                        "runAsUser": 0,
                        "runAsGroup": int(os.environ.get("ORCHEST_HOST_GID")),
                        "fsGroup": int(os.environ.get("ORCHEST_HOST_GID")),
                    },
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
                            "--verbosity=info",
                            "--snapshotMode=redo",
                            # From the docs: "This flag takes a single
                            # snapshot of the filesystem at the end of
                            # the build, so only one layer will be
                            # appended to the base image."  We use this
                            # flag since we can't cache layers due to
                            # now knoting how aggressive in caching we
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
                        "path": "/tmp/kaniko/cache",
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

    pod_name = f"image-cache-task-{task_uuid}"
    manifest = _get_base_image_cache_workflow_manifest(pod_name, base_image=base_image)
    k8s_custom_obj_api.create_namespaced_custom_object(
        "argoproj.io", "v1alpha1", "orchest", "workflows", body=manifest
    )
    utils.wait_for_pod_status(
        pod_name,
        "orchest",
        expected_statuses=["Running", "Succeeded", "Failed", "Unknown"],
        max_retries=100,
    )
    w = watch.Watch()
    pulled_image = False
    for event in w.stream(
        k8s_core_api.read_namespaced_pod_log,
        name=pod_name,
        container="main",
        namespace="orchest",
        follow=True,
    ):

        if not pulled_image:
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
                    "orchest",
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
    resp = k8s_core_api.read_namespaced_pod(name=pod_name, namespace="orchest")
    if resp.status.phase == "Failed":
        msg = "There was a problem pulling the base image."
        user_logs_file_object.write(msg)
        complete_logs_file_object.write(msg)
        complete_logs_file_object.flush()
        raise errors.ImageCachingFailedError()


def _build_image(
    task_uuid,
    image_name,
    build_context,
    dockerfile_path,
    user_logs_file_object,
    complete_logs_file_object,
):
    """Triggers an argo workflow to build an image and follows it."""
    pod_name = f"image-build-task-{task_uuid}"
    manifest = _get_image_build_workflow_manifest(
        pod_name, image_name, build_context["snapshot_host_path"], dockerfile_path
    )

    msg = "Building image...\n"
    user_logs_file_object.write(msg)
    complete_logs_file_object.write(msg)
    complete_logs_file_object.flush()
    k8s_custom_obj_api.create_namespaced_custom_object(
        "argoproj.io", "v1alpha1", "orchest", "workflows", body=manifest
    )

    utils.wait_for_pod_status(
        pod_name,
        "orchest",
        expected_statuses=["Running", "Succeeded", "Failed", "Unknown"],
        max_retries=100,
    )

    flag = __DOCKERFILE_RESERVED_FLAG
    found_beginning_flag = False
    found_ending_flag = False
    found_error_flag = False
    w = watch.Watch()
    for event in w.stream(
        k8s_core_api.read_namespaced_pod_log,
        name=pod_name,
        container="main",
        namespace="orchest",
        follow=True,
    ):
        complete_logs_file_object.writelines([event, "\n"])
        complete_logs_file_object.flush()
        # Beginning flag not found --> do not log.
        # Beginning flag found --> log until you find
        # the ending flag.
        if not found_beginning_flag:
            found_beginning_flag = event.startswith(flag)
            if found_beginning_flag:
                event = event.replace(flag, "")
                if len(event) > 0:
                    user_logs_file_object.writelines([event, "\n"])
        else:
            found_ending_flag = event.endswith(flag)
            found_error_flag = event.endswith(__DOCKERFILE_RESERVED_ERROR_FLAG)
            if found_ending_flag:
                user_logs_file_object.write("Storing image...")
                break
            elif found_error_flag:
                break
            else:
                user_logs_file_object.writelines([event, "\n"])

    # Keep writing logs while the image is being stored for UX.
    if found_ending_flag:
        done = False
        while not done:
            try:
                utils.wait_for_pod_status(
                    pod_name,
                    "orchest",
                    expected_statuses=["Succeeded", "Failed", "Unknown"],
                    max_retries=1,
                )
            except errors.PodNeverReachedExpectedStatusError:
                user_logs_file_object.write(".")
            else:
                user_logs_file_object.write("\n")
                done = True

    resp = k8s_core_api.read_namespaced_pod(name=pod_name, namespace="orchest")

    if found_error_flag or resp.status.phase == "Failed":
        msg = (
            "There was a problem building the image. The building script had a non 0 "
            "exit code, build failed.\n"
        )
        user_logs_file_object.write(msg)
        complete_logs_file_object.write(msg)
        complete_logs_file_object.flush()
        raise errors.ImageBuildFailedError()


def build_docker_image(
    task_uuid,
    image_name,
    build_context,
    dockerfile_path,
    user_logs_file_object,
    complete_logs_path,
):
    """Build a docker image with the given tag, context_path and docker
        file.

    Args:
        task_uuid:
        image_name:
        build_context:
        dockerfile_path:
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
                dockerfile_path,
                user_logs_file_object,
                complete_logs_file_object,
            )
        except (errors.ImageCachingFailedError, errors.ImageBuildFailedError) as e:
            complete_logs_file_object.write(e)
            complete_logs_file_object.flush(e)
            return "FAILURE"

        return "SUCCESS"


def cleanup_docker_artifacts(filters):
    """Cleanup container(s) and images given filters.

    Args:
        filters:

    Returns:

    """
    # Actually we are just looking for a single container, but the
    # syntax is the same as looking for N.
    containers_to_prune = docker_client.containers.list(filters=filters, all=True)
    tries = 0
    while containers_to_prune:
        docker_client.containers.prune(filters=filters)
        containers_to_prune = docker_client.containers.list(filters=filters, all=True)
        # Be as responsive as possible, only sleep at the first
        # iteration if necessary.
        if containers_to_prune:
            tries += 1
            if tries > 100:
                logging.error(
                    "Could not prune containers: %s"
                    % [con.attrs for con in containers_to_prune]
                )
                break
            time.sleep(1)

    # Only get to this point once there are no depending containers>
    # We DO NOT use all=True as an argument here because it will also
    # return intermediate layers, which will not be pruneable if the
    # build is successful. Those layers will be automatically deleted
    # when the env image is deleted. What we are actually doing here
    # is getting the last image created by the build process by getting
    # all the images created by the build process. Removing n-1 of them
    # will result in a no op, but 1 of them will cause the "ancestor
    # images to be removed as well.
    images_to_prune = docker_images_list_safe(docker_client, filters=filters)
    tries = 0
    while images_to_prune:
        docker_client.images.prune(filters=filters)
        images_to_prune = docker_images_list_safe(docker_client, filters=filters)
        # Be as responsive as possible, only sleep at the first
        # iteration if necessary.
        if images_to_prune:
            tries += 1
            if tries > 100:
                logging.error(
                    "Could not prune images: %s"
                    % [img.attrs for img in images_to_prune]
                )
                break
            time.sleep(1)


def delete_project_environment_dangling_images(project_uuid, environment_uuid):
    """Removes dangling images related to an environment.

    Dangling images are images that have been left nameless and
    tag-less and which are not referenced by any run
    or job which are pending or running.

    Args:
        project_uuid:
        environment_uuid:
    """
    # Look only through runs belonging to the project consider only
    # docker ids related to the environment_uuid.
    filters = {
        "label": [
            "_orchest_env_build_is_intermediate=0",
            f"_orchest_project_uuid={project_uuid}",
            f"_orchest_environment_uuid={environment_uuid}",
        ]
    }

    project_env_images = docker_images_list_safe(docker_client, filters=filters)

    for docker_img in project_env_images:
        remove_if_dangling(docker_img)


def delete_project_dangling_images(project_uuid):
    """Removes dangling images related to a project.

    Dangling images are images that have been left nameless and
    tag-less and which are not referenced by any run
    or job which are pending or running.

    Args:
        project_uuid:
    """
    # Look only through runs belonging to the project.
    filters = {
        "label": [
            "_orchest_env_build_is_intermediate=0",
            f"_orchest_project_uuid={project_uuid}",
        ]
    }

    project_images = docker_images_list_safe(docker_client, filters=filters)

    for docker_img in project_images:
        remove_if_dangling(docker_img)


def is_docker_image_in_use(img_id: str) -> bool:
    """True if the image is or will be in use by a run/job

    Args:
        img_id:

    Returns:
        bool:
    """

    int_runs = models.PipelineRun.query.filter(
        models.PipelineRun.image_mappings.any(docker_img_id=img_id),
        models.PipelineRun.status.in_(["PENDING", "STARTED"]),
    ).all()

    int_sessions = models.InteractiveSession.query.filter(
        models.InteractiveSession.image_mappings.any(docker_img_id=img_id),
        models.InteractiveSession.status.in_(["LAUNCHING", "RUNNING"]),
    ).all()

    jobs = models.Job.query.filter(
        models.Job.image_mappings.any(docker_img_id=img_id),
        models.Job.status.in_(["DRAFT", "PENDING", "STARTED", "PAUSED"]),
    ).all()

    return bool(int_runs) or bool(int_sessions) or bool(jobs)


def remove_if_dangling(img) -> bool:
    """Remove an image if its dangling.

    A dangling image is an image that is nameless and tag-less,
    and for which no runs exist that are PENDING or STARTED and that
    are going to use this image in one of their steps.

    Args:
        img:

    Returns:
        True if the image was successfully removed.
        False if not, e.g. if it is not nameless or if it is being used
        or will be used by a run.

    """
    # nameless image
    if len(img.attrs["RepoTags"]) == 0 and not is_docker_image_in_use(img.id):
        # need to check multiple times because of a race condition
        # given by the fact that cleaning up a project will
        # stop runs and jobs, then cleanup images and dangling
        # images, it might be that the celery worker running the task
        # still has to shut down the containers
        tries = 10
        while tries > 0:
            try:
                docker_client.images.remove(img.id)
                return True
            except errors.ImageNotFound:
                return False
            except Exception as e:
                current_app.logger.warning(
                    f"exception during removal of image {img.id}:\n{e}"
                )
                pass
            time.sleep(1)
            tries -= 1
    return False


def process_stale_environment_images(
    project_uuid: Optional[str] = None, only_marked_for_removal: bool = True
) -> None:
    """Makes stale environments unavailable to the user.

    Args:
        project_uuid: If specified, only this project environment images
            will be processed.
        only_marked_for_removal: Only consider images that have been
            marked for removal. Setting this to False allows the caller
            to, essentially, cleanup environments that are no longer in
            use.

    After an update, all environment images are invalidated to avoid the
    user having an environment with an SDK not compatible with the
    latest version of Orchest. At the same time, we need to maintain
    environment images that are in use by jobs. Environment images that
    are stale and are not in use by any job get deleted.  Orchest-ctl
    marks all environment images as "stale" on update, by adding a new
    name/tag to them. This function goes through all environments
    images, looking for images that have been marked as stale. Stale
    images have their "real" name, orchest-env-<proj_uuid>-<env_uuid>
    removed, so that the environment will have to be rebuilt to be
    available to the user for new runs.  The invalidation semantics are
    tied with the semantics of the validation module, which considers an
    environment as existing based on the existence of the orchest-env-*
    name.

    """
    filters = {"label": ["_orchest_env_build_is_intermediate=0"]}
    if project_uuid is not None:
        filters["label"].append(f"_orchest_project_uuid={project_uuid}")

    env_imgs = docker_images_list_safe(docker_client, filters=filters)
    for img in env_imgs:
        _process_stale_environment_image(img, only_marked_for_removal)


def _process_stale_environment_image(img, only_marked_for_removal) -> None:
    pr_uuid = img.labels.get("_orchest_project_uuid")
    env_uuid = img.labels.get("_orchest_environment_uuid")
    build_uuid = img.labels.get("_orchest_env_build_task_uuid")

    env_name = _config.ENVIRONMENT_IMAGE_NAME.format(
        project_uuid=pr_uuid, environment_uuid=env_uuid
    )

    removal_name = _config.ENVIRONMENT_IMAGE_REMOVAL_NAME.format(
        project_uuid=pr_uuid, environment_uuid=env_uuid, build_uuid=build_uuid
    )

    if (
        pr_uuid is None
        or env_uuid is None
        or build_uuid is None
        or
        # The image has not been marked for removal. This will happen
        # everytime Orchest is started except for a start which is
        # following an update.
        (f"{removal_name}:latest" not in img.tags and only_marked_for_removal)
        # Note that we can't check for env_name:latest not being in
        # img.tags because it might not be there if the image has
        # "survived" two updates in a row because a job is still using
        # that.
    ):
        return

    has_env_name = f"{env_name}:latest" in img.tags
    if has_env_name:
        if only_marked_for_removal:
            # This will just remove the orchest-env-* name/tag from the
            # image, the image will still be available for jobs that are
            # making use of that because the image still has the
            # <removal_name>.
            docker_images_rm_safe(docker_client, env_name)
        else:
            # The image is not dangling, e.g. it has not been
            # substituted by a more up to date version of the same
            # environment.
            return

    if not is_docker_image_in_use(img.id):
        # Delete through id, hence deleting the image regardless of the
        # fact that it has other tags. force=True is used to delete
        # regardless of the existence of stopped containers, this is
        # required because pipeline runs PUT to the orchest-api their
        # finished state before deleting their stopped containers.
        docker_images_rm_safe(docker_client, img.id, attempt_count=20, force=True)


def delete_dangling_orchest_images() -> None:
    """Deletes dangling Orchest images.

    After an update there could be old Orchest images dangling, for two
    reasons:
    - running containers during update, e.g. when running in "web" mode.
    - existing environmens making use of those images.

    After an update, all services are restarted, and at the start of
    this service, all user environment images coming from a previous
    Orchest version are deleted, which means those dangling images can
    now be deleted.

    """
    filters = {
        "label": ["maintainer=Orchest B.V. https://www.orchest.io"],
        # Note: a dangling image has no tags and no dependent child
        # images. A base image with no tags which is being used by an
        # environment, even a dangling one, will not be removed.
        "dangling": True,
    }
    env_imgs = docker_images_list_safe(docker_client, filters=filters)
    for img in env_imgs:
        # Since environment images might be built using Orchest base
        # images, make sure to not delete environment images by mistake
        # because of the filtering.
        env_uuid = img.labels.get("_orchest_environment_uuid")
        if env_uuid is None:
            docker_images_rm_safe(docker_client, img.id)
