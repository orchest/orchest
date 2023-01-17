import copy
import json
import os
import shutil
import time
import uuid
from typing import Any, Dict, List, Optional, Union

from celery.contrib.abortable import AbortableAsyncResult, AbortableTask
from celery.signals import worker_process_init
from celery.utils.log import get_task_logger
from kubernetes import client

from _orchest.internals import config as _config
from _orchest.internals.utils import copytree
from app import create_app
from app import errors as self_errors
from app import models, utils
from app.connections import db, k8s_core_api, k8s_custom_obj_api
from app.core import environments, notifications, pod_scheduling, registry, scheduler
from app.core.environment_image_builds import build_environment_image_task
from app.core.jupyter_image_builds import build_jupyter_image_task
from app.core.pipeline_runs import run_pipeline_workflow
from app.core.pipelines import Pipeline
from app.core.sessions import launch_noninteractive_session
from app.types import PipelineDefinition, RunConfig
from config import CONFIG_CLASS

logger = get_task_logger(__name__)

# TODO: create_app is called twice, meaning create_all (create
# databases) is called twice, which means celery-worker needs the
# /userdir bind to access the DB which is probably not a good idea.
# create_all should only be called once per app right?
application = create_app(CONFIG_CLASS, use_db=True, register_api=False)
celery = application.config["CELERY"]


@worker_process_init.connect
def dispose_of_existing_db_pool(**kwargs):
    """Disposes of existing db connections to avoid post-fork issues.

    The disposal is necessary to avoid issues with concurrent usage of
    the pool by different workers in the pre-fork celery model.

        https://docs.sqlalchemy.org/en/latest/core/pooling.html#using-connection-pools-with-multiprocessing
    """
    with application.app_context():
        db.engine.dispose()
        print("Disposed of existing db connection pool.")


@celery.task(bind=True, base=AbortableTask)
def run_pipeline(
    self,
    pipeline_definition: PipelineDefinition,
    run_config: RunConfig,
    session_uuid: str,
    task_id: Optional[str] = None,
) -> str:
    """Runs a pipeline partially.

    A partial run is described by the pipeline definition The
    call-order of the steps is always preserved, e.g. a --> b then a
    will always be run before b.

    Args:
        pipeline_definition: a json description of the pipeline.
        run_config: configuration of the run for the compute backend.

    Returns:
        Status of the pipeline run. "FAILURE" or "SUCCESS".

    """
    # Get the pipeline to run.
    pipeline = Pipeline.from_json(pipeline_definition)

    # REMOVABLE_ON_BREAKING_CHANGE. Added here to fix a race condition
    # in a way that doesn't require rebuilding images and creating new
    # jobs from the existing one, see commit db47da587.
    utils.ensure_logs_directory(run_config["project_dir"], run_config["pipeline_uuid"])

    # TODO: don't think this task_id is needed anymore. It was
    #       introduced as part of the scheduled runs which we don't use
    #       anymore.
    # Run the subgraph in parallel. And pass the id of the AsyncResult
    # object.
    # TODO: The commented line below is once we can introduce sessions.
    # session = run_pipeline.session
    task_id = task_id if task_id is not None else self.request.id

    try:
        with application.app_context():
            run_pipeline_workflow(
                session_uuid, task_id, pipeline, run_config=run_config
            )
    except Exception as e:
        logger.error(e)
        raise
    finally:
        # We get here either because the task was successful or was
        # aborted, in any case, delete the workflow.
        k8s_custom_obj_api.delete_namespaced_custom_object(
            "argoproj.io",
            "v1alpha1",
            _config.ORCHEST_NAMESPACE,
            "workflows",
            f"pipeline-run-task-{task_id}",
        )

    # The celery task has completed successfully. This is not related to
    # the success or failure of the pipeline itself.
    return "SUCCESS"


@celery.task(bind=True, base=AbortableTask)
def start_non_interactive_pipeline_run(
    self,
    job_uuid,
    project_uuid,
    pipeline_definition: PipelineDefinition,
    run_config: Dict[str, Union[str, Dict[str, str]]],
) -> str:
    """Starts a non-interactive pipeline run.

    It is a pipeline run that is part of a job.

    Args:
        job_uuid: UUID of the job.
        project_uuid: UUID of the project.
        pipeline_definition: A json description of the pipeline.
        run_config: Configuration of the run for the compute backend.
            Example: {
                'userdir_pvc': 'userdir-pvc',
                'project_dir': 'pipelines/uuid',
                'env_uuid_to_image': {
                    'b6527b0b-bfcc-4aff-91d1-37f9dfd5d8e8':
                        'sha256:61f82126945bb25dd85d6a5b122a1815df1c0c5f91621089cde0938be4f698d4'
                }
            }

    Returns:
        Status of the pipeline run. "FAILURE" or "SUCCESS".

    """
    pipeline_uuid = pipeline_definition["uuid"]

    snapshot_dir = utils.get_job_snapshot_path(project_uuid, pipeline_uuid, job_uuid)
    run_dir = utils.get_job_run_dir_path(
        project_uuid, pipeline_uuid, job_uuid, self.request.id
    )

    # Copy the contents of `snapshot_dir` to the new (not yet existing
    # folder) `run_dir`. No need to use_gitignore since the snapshot
    # was copied with use_gitignore=True.
    copytree(snapshot_dir, run_dir, use_gitignore=False)

    # Update the `run_config` for the interactive pipeline run. The
    # pipeline run should execute on the `run_dir` as its
    # `project_dir`. Note that the `project_dir` inside the
    # `run_config` has to be relative to userdir_pvc as it is used
    # by k8s as a subpath of userdir_pvc
    userdir_pvc = run_config["userdir_pvc"]

    # For non interactive runs the session uuid is equal to the task
    # uuid, which is actually the pipeline run uuid.
    session_uuid = self.request.id
    run_config["session_uuid"] = session_uuid
    run_config["session_type"] = "noninteractive"
    run_config["pipeline_uuid"] = pipeline_uuid
    run_config["project_uuid"] = project_uuid
    run_config["project_dir"] = run_dir

    # Overwrite the `pipeline.json`, that was copied from the snapshot,
    # with the new `pipeline.json` that contains the new parameters for
    # every step.
    pipeline_json = os.path.join(run_dir, run_config["pipeline_path"])
    with open(pipeline_json, "w") as f:
        json.dump(pipeline_definition, f, indent=4, sort_keys=True)

    # Note that run_config contains user_env_variables, which is of
    # interest for the session_config.
    session_config = copy.deepcopy(run_config)
    session_config.pop("env_uuid_to_image")
    session_config["userdir_pvc"] = userdir_pvc
    session_config["services"] = pipeline_definition.get("services", {})
    session_config["env_uuid_to_image"] = run_config["env_uuid_to_image"]

    with application.app_context():
        with launch_noninteractive_session(
            session_uuid,
            session_config,
            lambda: AbortableAsyncResult(session_uuid).is_aborted(),
        ):
            status = run_pipeline(
                pipeline_definition,
                run_config,
                session_uuid,
                task_id=self.request.id,
            )

    return status


# Note: cannot use ignore_result and also AsyncResult to abort
# https://stackoverflow.com/questions/9034091/how-to-check-task-status-in-celery
# @celery.task(bind=True, ignore_result=True)
@celery.task(bind=True, base=AbortableTask)
def build_environment_image(
    self,
    project_uuid: str,
    environment_uuid: str,
    image_tag: str,
    project_path,
) -> str:
    """Builds an environment, pushing a new image to the registry.

    Args:
        project_uuid: UUID of the project.
        environment_uuid: UUID of the environment.
        project_path: Path to the project.

    Returns:
        Status of the environment build.

    """
    with application.app_context():
        return build_environment_image_task(
            self.request.id, project_uuid, environment_uuid, image_tag, project_path
        )


# Note: cannot use ignore_result and also AsyncResult to abort
# https://stackoverflow.com/questions/9034091/how-to-check-task-status-in-celery
# @celery.task(bind=True, ignore_result=True)
@celery.task(bind=True, base=AbortableTask)
def build_jupyter_image(self, image_tag: str) -> str:
    """Builds Jupyter image, pushing a new image to the registry.

    Returns:
        Status of the environment build.

    """

    with application.app_context():
        return build_jupyter_image_task(self.request.id, image_tag)


@celery.task(bind=True, base=AbortableTask)
def delete_job_pipeline_run_directories(
    self,
    project_uuid: str,
    pipeline_uuid: str,
    job_uuid: str,
    pipeline_run_uuids: List[str],
) -> str:
    """Deletes a list of job pipeline run directories given uuids."""
    job_dir = os.path.join("/userdir", "jobs", project_uuid, pipeline_uuid, job_uuid)
    for ppl_run_uuid in pipeline_run_uuids:
        shutil.rmtree(os.path.join(job_dir, ppl_run_uuid), ignore_errors=True)

    return "SUCCESS"


def _should_run_registry_gc() -> bool:
    # This is needed because registry GC can't be run while a push is -
    # potentially - ongoing.
    ongoing_env_builds = db.session.query(
        db.session.query(models.EnvironmentImageBuild)
        .filter(models.EnvironmentImageBuild.status.in_(["PENDING", "STARTED"]))
        .exists()
    ).scalar()
    ongoing_jupyter_builds = db.session.query(
        db.session.query(models.JupyterImageBuild)
        .filter(models.JupyterImageBuild.status.in_(["PENDING", "STARTED"]))
        .exists()
    ).scalar()
    active_env_images_to_be_pushed = environments.get_active_environment_images(
        stored_in_registry=False
    )
    active_jupyter_images_to_be_pushed = utils.get_active_custom_jupyter_images(
        stored_in_registry=False
    )
    return (
        not active_env_images_to_be_pushed
        and not active_jupyter_images_to_be_pushed
        and not ongoing_env_builds
        and not ongoing_jupyter_builds
    )


@celery.task(bind=True, base=AbortableTask)
def registry_garbage_collection(self) -> None:
    """Runs the registry garbage collection task.

    Images that are to be removed are removed from the registry and
    registry garbage collection is run if necessary.
    """
    with application.app_context():
        try:
            _registry_garbage_collection()
            scheduler.notify_scheduled_job_succeeded(self.request.id)
        except Exception as e:
            logger.error(e)
            scheduler.notify_scheduled_job_failed(self.request.id)
            raise e
    return "SUCCESS"


def _registry_garbage_collection() -> None:
    with application.app_context():
        # It's important that the check is made after the scheduler job
        # is set as 'STARTED' to avoid race conditions. See the
        # ctl/active-custom-jupyter-images-to-push and
        # environment-images/to-push endpoints for more details.
        if not _should_run_registry_gc():
            logger.info(
                "Skipping registry GC to avoid a race condition with a potentially "
                "ongoing image push."
            )
            return

        has_deleted_images = False
        repositories_to_gc = []
        repos = registry.get_list_of_repositories()

        # Env images + custom Jupyter images.
        repos_of_interest = [
            repo
            for repo in repos
            if repo.startswith("orchest-env")
            or repo.startswith(_config.JUPYTER_IMAGE_NAME)
        ]
        active_env_images = environments.get_active_environment_images()
        active_env_image_names = set(
            _config.ENVIRONMENT_IMAGE_NAME.format(
                project_uuid=img.project_uuid, environment_uuid=img.environment_uuid
            )
            + f":{img.tag}"
            for img in active_env_images
        )
        active_custom_jupyter_images = utils.get_active_custom_jupyter_images()
        active_custom_jupyter_image_names = set(
            f"{_config.JUPYTER_IMAGE_NAME}:{img.tag}"
            for img in active_custom_jupyter_images
        )

        active_image_names = active_env_image_names.union(
            active_custom_jupyter_image_names
        )

        # Go through all env image repos, for every tag, check if the
        # image is in the active images, if not, delete it. If the
        # image is not among the actives it means that it's either in
        # the set of images where marked_for_removal = True, or the
        # image isn't there at all, i.e. the project or environment has
        # been deleted.
        for repo in repos_of_interest:
            tags = registry.get_tags_of_repository(repo)

            all_tags_removed = True
            for tag in tags:
                name = f"{repo}:{tag}"
                if name not in active_image_names:
                    logger.info(f"Deleting {name} from the registry.")
                    has_deleted_images = True
                    digest = registry.get_manifest_digest(repo, tag)
                    try:
                        registry.delete_image_by_digest(
                            repo, digest, run_garbage_collection=False
                        )
                    except self_errors.ImageRegistryDeletionError as e:
                        logger.warning(e)
                else:
                    all_tags_removed = False
                    logger.info(f"Not deleting {name} from the registry.")

            if all_tags_removed:
                repositories_to_gc.append(repo)

        if has_deleted_images or repositories_to_gc:
            registry.run_registry_garbage_collection(repositories_to_gc)


@celery.task(bind=True, base=AbortableTask)
def process_notifications_deliveries(self):
    with application.app_context():
        try:
            notifications.process_notifications_deliveries_task()
            scheduler.notify_scheduled_job_succeeded(self.request.id)
        except Exception as e:
            logger.error(e)
            scheduler.notify_scheduled_job_failed(self.request.id)
            raise e
    return "SUCCESS"


@celery.task(bind=True, base=AbortableTask)
def git_import(
    self,
    url: str,
    project_name: Optional[str] = None,
    auth_user_uuid: Optional[str] = None,
):
    with application.app_context():
        try:
            models.GitImport.query.filter(
                models.GitImport.uuid == self.request.id
            ).update({"status": "STARTED"})
            db.session.commit()

            pod_name = f"git-import-{self.request.id}"
            project_uuid = _run_git_import_pod(
                pod_name, url, project_name, auth_user_uuid
            )

            models.GitImport.query.filter(
                models.GitImport.uuid == self.request.id
            ).update({"status": "SUCCESS", "project_uuid": project_uuid})
            db.session.commit()
        except Exception as e:
            logger.error(e)
            result = {}
            if isinstance(e, self_errors.GitImportError):
                result["error"] = type(e).__name__
            if isinstance(e, TimeoutError):
                result["error"] = "TimeoutError"
            models.GitImport.query.filter(
                models.GitImport.uuid == self.request.id
            ).update({"status": "FAILURE", "result": result})
            db.session.commit()
            return "FAILURE"
    return "SUCCESS"


def _run_git_import_pod(
    pod_name: str,
    repo_url: str,
    project_name: Optional[str],
    auth_user_uuid: Optional[str],
) -> str:
    try:
        manifest = _get_git_import_pod_manifest(
            pod_name, repo_url, project_name, auth_user_uuid
        )
        k8s_core_api.create_namespaced_pod(_config.ORCHEST_NAMESPACE, manifest)
        exit_code_to_exception = {
            2: self_errors.ProjectWithSameNameExists(),
            3: self_errors.ProjectNotDiscoveredByWebServer(),
            4: self_errors.NoAccessRightsOrRepoDoesNotExists(),
        }
        for _ in range(30 * 60):
            try:
                pod = k8s_core_api.read_namespaced_pod(
                    pod_name, namespace=_config.ORCHEST_NAMESPACE
                )
            # Assume it's a race condition w.r.t. the pod being created.
            except client.ApiException as e:
                if e.status != 404:
                    raise
            if pod.status.phase == "Succeeded" or pod.status.phase == "Failed":
                break
            time.sleep(1)
        else:
            raise TimeoutError()

        logs = k8s_core_api.read_namespaced_pod_log(
            pod_name, namespace=_config.ORCHEST_NAMESPACE
        )

        if pod.status.phase == "Failed":
            exit_code = pod.status.container_statuses[0].state.terminated.exit_code
            raise exit_code_to_exception.get(
                exit_code,
                self_errors.GitCloneFailed(
                    status_code=exit_code, stdout="", stderr=logs
                ),
            )
        else:
            project_uuid = logs.split()[-1].strip()
            # Make sure the project_uuid is being passed.
            try:
                uuid.UUID(project_uuid, version=4)
            except ValueError:
                raise self_errors.GitCloneFailed()
            return project_uuid
    finally:
        k8s_core_api.delete_namespaced_pod(
            pod_name,
            _config.ORCHEST_NAMESPACE,
        )


def _get_git_import_pod_manifest(
    pod_name: str,
    repo_url: str,
    project_name: Optional[str],
    auth_user_uuid: Optional[str],
) -> Dict[str, Any]:
    args = utils.get_add_ssh_secrets_script() + (
        "python /orchest/services/orchest-api/app/scripts/git-import.py "
        f"--task-uuid {pod_name} --repo-url {repo_url}"
    )

    if project_name is not None:
        args += f" --project-name {project_name}"

    known_hosts_vol, known_hosts_vol_mount = utils.get_known_hosts_volume_and_mount()

    volumes = [
        {
            "name": "userdir-pvc",
            "persistentVolumeClaim": {
                "claimName": "userdir-pvc",
            },
        },
        known_hosts_vol,
    ]

    volume_mounts = [
        {
            "name": "userdir-pvc",
            "mountPath": "/userdir",
        },
        known_hosts_vol_mount,
    ]

    if auth_user_uuid is not None:
        v, vm = utils.get_user_ssh_keys_volumes_and_mounts(auth_user_uuid)
        volumes.extend(v)
        volume_mounts.extend(vm)
        args = utils.get_auth_user_git_config_setup_script(auth_user_uuid) + args

    manifest = {
        "apiVersion": "v1",
        "kind": "Pod",
        "metadata": {"name": pod_name},
        "spec": {
            "containers": [
                {
                    "name": "git-import",
                    "image": f"orchest/celery-worker:{_config.ORCHEST_VERSION}",
                    "command": ["/bin/sh", "-c"],
                    "args": [args],
                    "env": [],
                    "volumeMounts": volume_mounts,
                },
            ],
            "restartPolicy": "Never",
            "volumes": volumes,
        },
    }
    pod_scheduling.modify_git_import_scheduling_behaviour(manifest)
    return manifest
