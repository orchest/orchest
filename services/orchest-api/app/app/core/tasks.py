import asyncio
import copy
import json
import os
import shutil
from typing import Dict, List, Optional, Union

import aiohttp
from celery import Task
from celery.contrib.abortable import AbortableAsyncResult, AbortableTask
from celery.utils.log import get_task_logger

from _orchest.internals import config as _config
from _orchest.internals.utils import copytree, rmtree
from app import create_app
from app.celery_app import make_celery
from app.connections import k8s_custom_obj_api
from app.core.environment_image_builds import build_environment_image_task
from app.core.jupyter_image_builds import build_jupyter_image_task
from app.core.pipelines import Pipeline, run_pipeline_workflow
from app.core.sessions import launch_noninteractive_session
from app.types import PipelineDefinition, RunConfig
from config import CONFIG_CLASS

logger = get_task_logger(__name__)

# TODO: create_app is called twice, meaning create_all (create
# databases) is called twice, which means celery-worker needs the
# /userdir bind to access the DB which is probably not a good idea.
# create_all should only be called once per app right?
celery = make_celery(create_app(CONFIG_CLASS, use_db=False), use_backend_db=True)


# This will not work yet, because Celery does not yet support asyncio
# tasks. In Celery 5.0 however this should be possible.
# https://stackoverflow.com/questions/39815771/how-to-combine-celery-with-asyncio
class APITask(Task):
    """

    Idea:
        Make the aiohttp.ClientSession persistent. Then we get:

        "So if you’re making several requests to the same host, the
        underlying TCP connection will be reused, which can result in a
        significant performance increase."

    Recources:
        https://docs.celeryproject.org/en/master/userguide/tasks.html#instantiation
    """

    _session = None

    async def get_clientsession(self):
        return await aiohttp.ClientSession()

    @property
    async def session(self):
        """
        TODO:
            Think about how to create this property since await in a
            property is not according to PEP8
            https://stackoverflow.com/questions/54984337/how-should-you-create-properties-when-using-asyncio

            Possibility:
            https://async-property.readthedocs.io/en/latest/readme.html
        """
        if self._session is None:
            self._session = await self.get_clientsession()
        return self._session


async def run_pipeline_async(
    session_uuid: str, run_config: RunConfig, pipeline: Pipeline, task_id: str
):
    try:
        await run_pipeline_workflow(
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

    # The celery task has completed successfully. This is not
    # related to the success or failure of the pipeline itself.
    return "SUCCESS"


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

    # TODO: don't think this task_id is needed anymore. It was
    #       introduced as part of the scheduled runs which we don't use
    #       anymore.
    # Run the subgraph in parallel. And pass the id of the AsyncResult
    # object.
    # TODO: The commented line below is once we can introduce sessions.
    # session = run_pipeline.session
    task_id = task_id if task_id is not None else self.request.id

    # TODO: could make the celery task fail in case the pipeline run
    # failed. Although the run did complete successfully from a task
    # scheduler perspective.
    # https://stackoverflow.com/questions/7672327/how-to-make-a-celery-task-fail-from-within-the-task
    return asyncio.run(run_pipeline_async(session_uuid, run_config, pipeline, task_id))


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

    job_dir = os.path.join("/userdir", "jobs", project_uuid, pipeline_uuid, job_uuid)
    snapshot_dir = os.path.join(job_dir, "snapshot")
    run_dir = os.path.join(job_dir, self.request.id)

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
    run_config["run_endpoint"] = f"jobs/{job_uuid}"

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
    session_config.pop("run_endpoint")
    session_config["userdir_pvc"] = userdir_pvc
    session_config["services"] = pipeline_definition.get("services", {})
    session_config["env_uuid_to_image"] = run_config["env_uuid_to_image"]

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

    return build_environment_image_task(
        self.request.id, project_uuid, environment_uuid, image_tag, project_path
    )


# Note: cannot use ignore_result and also AsyncResult to abort
# https://stackoverflow.com/questions/9034091/how-to-check-task-status-in-celery
# @celery.task(bind=True, ignore_result=True)
@celery.task(bind=True, base=AbortableTask)
def build_jupyter_image(
    self,
) -> str:
    """Builds Jupyter image, pushing a new image to the registry.

    Returns:
        Status of the environment build.

    """

    return build_jupyter_image_task(self.request.id)


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
    for uuid in pipeline_run_uuids:
        shutil.rmtree(os.path.join(job_dir, uuid), ignore_errors=True)

    return "SUCCESS"


@celery.task(bind=True, base=AbortableTask)
def delete_base_images_cache(self) -> str:
    """Deletes the base images cache.

    Note: this is currently a no op due to the fact that the
    celery-worker doesn't mount the cache directory: K8S_TODO: either
    make this happen through a pod so that the code can be made to run
    in the right node (nodeSelector) or make sure this deletion works
    once the distributed file system is integrated. Solution 2 is
    preferable given that performance won't be an issue if the data
    isn't on the same node of the celery worker given the type of
    operation and it avoids 1 layer of indirection.
    """
    try:
        with os.scandir(_config.USERDIR_BASE_IMAGES_CACHE) as entries:
            for entry in entries:
                rmtree(entry)
    except FileNotFoundError:
        ...
    return "SUCCESS"
