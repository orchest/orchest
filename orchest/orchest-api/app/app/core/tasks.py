import asyncio
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
    # # TODO: the pipeline_dir can be gotten from the `run_config`
    # # TODO: specify how the pipeline_dir path is given inside the
    # #       schema.
    # pipeline_uuid = post_data['pipeline_description']['uuid']
    # pipeline_dir = os.path.join('/userdir', 'pipelines', pipeline_uuid)
    # # pipeline_dir: str = run_config['pipeline_dir']

    # # TODO: Now that the copying is done here we need the mount of
    # #       the userdir, this can be removed once Celery takes care
    # #       of this.
    # # Make copy of `pipeline_dir` to `run_dir`.
    # # /userdir/pipelines/{pipeline_uuid}/
    # # -> /userdir/scheduled_runs/{pipeline_uuid}/{run_uuid}/
    # scheduled_runs_dir = os.path.join('/userdir', 'scheduled_runs')
    # run_base_dir = os.path.join(scheduled_runs_dir, pipeline_uuid)
    # run_dir = os.path.join(run_base_dir, run_uuid)
    # os.makedirs(run_base_dir, exist_ok=True)
    # copytree(pipeline_dir, run_dir)

    # # Update `pipeline_dir` in `run_config`.
    # run_config = post_data['run_config']
    # scheduled_run_subpath = os.path.join('scheduled_runs', pipeline_uuid, run_uuid)
    # run_config['pipeline_dir'] = os.path.join(run_config['host_user_dir'],
    #                                           scheduled_run_subpath)

    # run_config['run_endpoint'] = 'experiments'

    # Copy the snapshot to its own location.
    # Use self.request.id

    # Fix the parameters

    # Update the pipeline_dir that is part of the run_config to its new
    # location.

    # do `run_partial`

    pass
