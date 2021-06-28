import asyncio
import copy
import json
import os
from typing import Any, Dict, Optional, Union

import aiohttp
from celery import Task
from celery.contrib.abortable import AbortableAsyncResult, AbortableTask
from celery.utils.log import get_task_logger

from app import create_app
from app.celery_app import make_celery
from app.connections import docker_client
from app.core.environment_builds import build_environment_task
from app.core.jupyter_builds import build_jupyter_task
from app.core.pipelines import Pipeline, PipelineDefinition
from app.core.sessions import launch_noninteractive_session
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


async def get_run_status(
    task_id: str,
    type: str,
    run_endpoint: str,
    uuid: Optional[str] = None,
) -> Any:

    base_url = f"{CONFIG_CLASS.ORCHEST_API_ADDRESS}/{run_endpoint}/{task_id}"

    if type == "step":
        url = f"{base_url}/{uuid}"

    elif type == "pipeline":
        url = base_url

    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.json()


# Periodically check whether task has been aborted, if it has been, kill
# all running containers to short-circuit pipeline run.
async def check_pipeline_run_task_status(run_config, pipeline, task_id):

    while True:

        # check status every second
        await asyncio.sleep(1)

        aborted = AbortableAsyncResult(task_id).is_aborted()
        run_status = await get_run_status(
            task_id, "pipeline", run_config["run_endpoint"]
        )

        # might be missing if the record has been removed, i.e.
        # due to a cleanup that might happen if the project has been
        # removed
        aborted = aborted or "status" not in run_status
        ready = run_status.get("status", "FAILURE") in ["SUCCESS", "FAILURE"]

        if aborted:
            pipeline.kill_all_running_steps(
                task_id, "docker", {"docker_client": docker_client}
            )
        if ready or aborted:
            break


async def run_pipeline_async(run_config, pipeline, task_id):
    try:
        await asyncio.gather(
            *[
                asyncio.create_task(pipeline.run(task_id, run_config=run_config)),
                asyncio.create_task(
                    check_pipeline_run_task_status(run_config, pipeline, task_id)
                ),
            ]
        )
    # Make sure to cleanup containers in any case.
    finally:
        # Any code that depends on the fact that both pipeline.run and
        # check_pipeline_run_task_status have terminated should be here.
        # for example, pipeline.run  PUTs the state of the run when it
        # ends, so any code dependant on the status being set cannot be
        # run in check_pipeline_run_task_status.
        run_config["docker_client"] = docker_client
        pipeline.remove_containerization_resources(task_id, "docker", run_config)

    # The celery task has completed successfully. This is not
    # related to the success or failure of the pipeline itself.
    return "SUCCESS"


@celery.task(bind=True, base=AbortableTask)
def run_pipeline(
    self,
    pipeline_definition: PipelineDefinition,
    project_uuid: str,
    run_config: Dict[str, Union[str, Dict[str, str]]],
    task_id: Optional[str] = None,
) -> str:
    """Runs a pipeline partially.

    A partial run is described by the pipeline definition The
    call-order of the steps is always preserved, e.g. a --> b then a
    will always be run before b.

    Args:
        pipeline_definition: a json description of the pipeline.
        run_config: configuration of the run for the compute backend.
            Example: {
                'session_uuid' : 'uuid',
                'session_type' : 'interactive',
                'run_endpoint': 'runs',
                'project_dir': '/home/../pipelines/uuid',
                'env_uuid_docker_id_mappings': {
                    'b6527b0b-bfcc-4aff-91d1-37f9dfd5d8e8':
                        'sha256:61f82126945bb25dd85d6a5b122a1815df1c0c5f91621089cde0938be4f698d4'
                }
            }

    Returns:
        Status of the pipeline run. "FAILURE" or "SUCCESS".

    """
    run_config["pipeline_uuid"] = pipeline_definition["uuid"]
    run_config["project_uuid"] = project_uuid

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
    return asyncio.run(run_pipeline_async(run_config, pipeline, task_id))


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
                'host_user_dir': '/home/../userdir',
                'project_dir': '/home/../pipelines/uuid',
                'env_uuid_docker_id_mappings': {
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
    # folder) `run_dir` (that will then be created by `copytree`).
    # copytree(snapshot_dir, run_dir)
    os.system('cp -R "%s" "%s"' % (snapshot_dir, run_dir))

    # Update the `run_config` for the interactive pipeline run. The
    # pipeline run should execute on the `run_dir` as its
    # `project_dir`. Note that the `project_dir` inside the
    # `run_config` has to be the abs path w.r.t. the host because it is
    # used by the `docker.sock` when mounting the dir to the container
    # of a step.
    host_userdir = run_config["host_user_dir"]
    host_base_user_dir = os.path.split(host_userdir)[0]

    # For non interactive runs the session uuid is equal to the task
    # uuid.
    session_uuid = self.request.id
    run_config["session_uuid"] = session_uuid
    run_config["session_type"] = "noninteractive"
    run_config["pipeline_uuid"] = pipeline_uuid
    run_config["project_uuid"] = project_uuid
    # To join the paths, the `run_dir` cannot start with `/userdir/...`
    # but should start as `userdir/...`
    run_config["project_dir"] = os.path.join(host_base_user_dir, run_dir[1:])
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
    session_config.pop("env_uuid_docker_id_mappings")
    session_config.pop("run_endpoint")
    session_config["host_userdir"] = host_userdir
    session_config["services"] = pipeline_definition.get("services", {})
    session_config["env_uuid_docker_id_mappings"] = run_config[
        "env_uuid_docker_id_mappings"
    ]

    with launch_noninteractive_session(
        docker_client,
        session_uuid,
        session_config,
    ):
        status = run_pipeline(
            pipeline_definition, project_uuid, run_config, task_id=self.request.id
        )

    return status


# Note: cannot use ignore_result and also AsyncResult to abort
# https://stackoverflow.com/questions/9034091/how-to-check-task-status-in-celery
# @celery.task(bind=True, ignore_result=True)
@celery.task(bind=True, base=AbortableTask)
def build_environment(
    self,
    project_uuid,
    environment_uuid,
    project_path,
) -> str:
    """Builds an environment, producing a new image in the docker env.

    Args:
        project_uuid: UUID of the project.
        environment_uuid: UUID of the environment.
        project_path: Path to the project.

    Returns:
        Status of the environment build.

    """

    return build_environment_task(
        self.request.id, project_uuid, environment_uuid, project_path
    )


# Note: cannot use ignore_result and also AsyncResult to abort
# https://stackoverflow.com/questions/9034091/how-to-check-task-status-in-celery
# @celery.task(bind=True, ignore_result=True)
@celery.task(bind=True, base=AbortableTask)
def build_jupyter(
    self,
) -> str:
    """Builds Jupyter image, producing a new image in the docker env.

    Returns:
        Status of the environment build.

    """

    return build_jupyter_task(self.request.id)
