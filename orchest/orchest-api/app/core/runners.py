import asyncio
from typing import Dict, Union

from app import create_app
from app.celery import make_celery
from app.utils import Pipeline, PipelineDescription
from config import CONFIG_CLASS


celery = make_celery(create_app(CONFIG_CLASS))


@celery.task(bind=True)
def run_partial(self,
                pipeline_description: PipelineDescription,
                run_config: Dict[str, Union[str, Dict[str, str]]]) -> None:
    """Runs a pipeline partially.

    A partial run is described by the pipeline description, selection of
    step UUIDs and a run type. The call-order of the steps is always
    preserved, e.g. a --> b then a will always be run before b.

    Type of runs:
        * Run all the steps of the pipeline.
        * Given a selection of UUIDs run only the selection.
        * Given a selection of UUIDs, run all their proper ancestors (i.e.
          parents in a directed graph). This can be done either inclusive
          or exclusive of the selection (making it run all ancestors
          instead of proper ancestors - thus including the step itself).

    NOTE:
        Running a pipeline fully can also be described as a partial run.

    Args:
        uuids: a selection/sequence of pipeline step UUIDs. If `run_type`
            equals "full", then this argument is ignored.
        run_type: one of ("full", "selection", "incoming").
        pipeline_description: a json description of the pipeline.
    """
    # Get the pipeline to run.
    pipeline = Pipeline.from_json(pipeline_description)

    # Run the subgraph in parallel. And pass the id of the AsyncResult
    # object.
    return asyncio.run(pipeline.run(self.request.id, run_config=run_config))
