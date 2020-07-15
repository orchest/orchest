import asyncio
import json
import os
from shutil import copytree
from typing import Dict, Optional, Union

import aiohttp
from celery import Task

from app import create_app
from app.celery_app import make_celery
from app.connections import docker_client
from app.core.pipelines import Pipeline, PipelineDescription
from app.core.sessions import launch_session
from config import CONFIG_CLASS


# TODO: create_app is called twice, meaning create_all (create
# databases) is called twice, which means celery-worker needs the
# /userdir bind to access the DB which is probably not a good idea.
# create_all should only be called once per app right?
celery = make_celery(create_app(CONFIG_CLASS, use_db=False))


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


# TODO: rename this function maybe? `start_pipeline_run` since it no
#       longer constructs the partial, the construct is already done
#       in the API. `run_pipeline` sounds even better to me
# @celery.task(bind=True, base=APITask)
@celery.task(bind=True)
def run_partial(self,
                pipeline_description: PipelineDescription,
                run_config: Dict[str, Union[str, Dict[str, str]]],
                task_id: Optional[str] = None) -> str:
    """Runs a pipeline partially.

    A partial run is described by the pipeline description The
    call-order of the steps is always preserved, e.g. a --> b then a
    will always be run before b.

    Args:
        pipeline_description: a json description of the pipeline.
        run_config: configuration of the run for the compute backend.

    Returns:
        Status of the pipeline run. "FAILURE" or "SUCCESS".
    """
    # Get the pipeline to run.
    pipeline = Pipeline.from_json(pipeline_description)

    # Run the subgraph in parallel. And pass the id of the AsyncResult
    # object.
    # TODO: The commented line below is once we can introduce sessions.
    # session = run_partial.session
    task_id = task_id if task_id is not None else self.request.id
    return asyncio.run(pipeline.run(task_id, run_config=run_config))


@celery.task(bind=True)
def start_non_interactive_pipeline_run(
    self,
    experiment_uuid,
    pipeline_description: PipelineDescription,
    run_config: Dict[str, Union[str, Dict[str, str]]]
) -> None:
    """Starts a non-interactive pipeline run.

    It is a pipeline run that is part of an experiment.

    """
    pipeline_uuid = pipeline_description['uuid']
    experiment_dir = os.path.join('/userdir', 'experiments',
                                  pipeline_uuid, experiment_uuid)
    snapshot_dir = os.path.join(experiment_dir, 'snapshot')
    run_dir = os.path.join(experiment_dir, self.request.id)

    # Copy the contents of `snapshot_dir` to the new (not yet existing
    # folder) `run_dir` (that will then be created by `copytree`).
    # TODO: It should not copy all directories, e.g. not "data".
    # copytree(snapshot_dir, run_dir)
    os.system("cp -R %s %s" % (snapshot_dir, run_dir))

    # Update the `run_config` for the interactive pipeline run. The
    # pipeline run should execute on the `run_dir` as its `pipeline_dir`
    # NOTE: the `pipeline_dir` inside the `run_config` has to be the abs
    # path w.r.t. the host because it is used by the `docker.sock` when
    # mounting the dir to the container of a step.
    host_base_user_dir = os.path.split(run_config['host_user_dir'])[0]
    # To join the paths, the `run_dir` cannot start with `/userdir/...`
    # but should start as `userdir/...`
    run_config['pipeline_dir'] = os.path.join(host_base_user_dir, run_dir[1:])
    run_config['run_endpoint'] = f'experiments/{experiment_uuid}'

    # Overwrite the `pipeline.json`, that was copied from the snapshot,
    # with the new `pipeline.json` that contains the new parameters for
    # every step.
    pipeline_json = os.path.join(run_dir, 'pipeline.json')
    with open(pipeline_json, 'w') as f:
        json.dump(pipeline_description, f)

    # TODO: `run_partial` does not yet support the `experiment_uuid`,
    #       but we need it to correctly update the status of the steps.
    #       Maybe we can incorporate it in the `run_endpoint` of
    #       `run_config` by doing ``f'experiments/{experiment_uuid}'``.
    # TODO: Have to make sure that somewhere a memory-server is started
    #       so that the pipeline run gets its own memory store.

    with launch_session(
        docker_client,
        experiment_uuid,
        run_config['pipeline_dir'],
        interactive=False,
    ) as session:
        status = run_partial(pipeline_description, run_config, task_id=self.request.id)

    return status
