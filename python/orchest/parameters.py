import json
from typing import Any, Dict

from orchest.errors import StepUUIDResolveError
from orchest.pipeline import Pipeline
from orchest.utils import get_step_uuid


def get_params(pipeline_description_path: str = 'pipeline.json') -> Dict[str, Any]:
    with open(pipeline_description_path, 'r') as f:
        pipeline_description = json.load(f)

    pipeline = Pipeline.from_json(pipeline_description)
    try:
        step_uuid = get_step_uuid(pipeline)
    except StepUUIDResolveError:
        raise StepUUIDResolveError('Failed to determine from where to get data.')

    step = pipeline.get_step_by_uuid(step_uuid)
    params = step.get_params()

    return params


def update_params(
    params: Dict[str, Any],
    pipeline_description_path: str = 'pipeline.json'
) -> Dict[str, Any]:
    """Update parameters of current step.

    Additionally, you can set new parameters by giving parameters that
    do not yet exist in the `parameters` property of the pipeline step.

    """
    with open(pipeline_description_path, 'r') as f:
        pipeline_description = json.load(f)

    pipeline = Pipeline.from_json(pipeline_description)
    try:
        step_uuid = get_step_uuid(pipeline)
    except StepUUIDResolveError:
        raise StepUUIDResolveError('Failed to determine from where to get data.')

    # TODO: This is inefficient, we could just use the `step_uuid` and
    #       update the params of the `pipeline_description` and write it
    #       back to the `pipeline.json`. However, I think it is good
    #       practice to use our own defined classes to do so.
    step = pipeline.get_step_by_uuid(step_uuid)
    curr_params = step.get_params()
    curr_params.update(params)

    with open(pipeline_description_path, 'w') as f:
        json.dump(pipeline.to_dict(), f)

    return
