import asyncio
import json
import os
from shutil import copytree
from typing import Dict, Union

import aiohttp
from celery import Task

from app import create_app
from app.celery_app import make_celery
from app.core.pipelines import Pipeline, PipelineDescription
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


# @celery.task(bind=True, base=APITask)
@celery.task(bind=True)
def run_partial(self,
                pipeline_description: PipelineDescription,
                run_config: Dict[str, Union[str, Dict[str, str]]]) -> None:
    """Runs a pipeline partially.

    A partial run is described by the pipeline description The
    call-order of the steps is always preserved, e.g. a --> b then a
    will always be run before b.

    Args:
        pipeline_description: a json description of the pipeline.
        run_config: configuration of the run for the compute backend.
    """
    # Get the pipeline to run.
    pipeline = Pipeline.from_json(pipeline_description)

    # Run the subgraph in parallel. And pass the id of the AsyncResult
    # object.
    # TODO: The commented line below is once we can introduce sessions.
    # session = run_partial.session
    return asyncio.run(pipeline.run(self.request.id, run_config=run_config))


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
    experiment_base_dir = os.path.join('/userdir', 'experiments',
                                       pipeline_uuid, experiment_uuid)
    snapshot_dir = os.path.join(experiment_base_dir, 'snapshot')
    run_dir = os.path.join(experiment_base_dir, self.request.id)

    # Copy the contents of `snapshot_dir` to the new (not yet existing
    # folder) `run_dir` (that will then be created by `copytree`).
    copytree(snapshot_dir, run_dir)

    # # Update `pipeline_dir` in `run_config`.
    # run_config = post_data['run_config']
    # scheduled_run_subpath = os.path.join('scheduled_runs', pipeline_uuid, run_uuid)
    # run_config['pipeline_dir'] = os.path.join(run_config['host_user_dir'],
    #                                           scheduled_run_subpath)
    # TODO: check how the `pipeline_dir` is passed everywhere. This is
    #       very confusing right now and we should decide exactly how.
    # NOTE: the `pipeline_dir` inside the `run_config` has to be the abs
    # path w.r.t. the host because it is used by the `docker.sock` when
    # mounting the dir to the container of a step.
    host_base_user_dir = os.path.split(run_config['host_user_dir'])[0]
    run_config['pipeline_dir'] = os.path.join(host_base_user_dir, run_dir)
    run_config['run_endpoint'] = 'experiments'

    # Overwrite the `pipeline.json` from the snapshot with the new
    # `pipeline.json` that contains the new parameters for every step.
    pipeline_json = os.path.join(run_dir, 'pipeline.json')
    with open(pipeline_json, 'w') as f:
        json.dump(pipeline_description, f)

    # TODO: `run_partial` does not yet support the `experiment_uuid`,
    #       but we need it to correctly update the status of the steps.
    #       Maybe we can incorporate it in the `run_endpoint` of
    #       `run_config` by doing ``f'experiments/{experiment_uuid}'``.
    return run_partial(pipeline_description, run_config)
