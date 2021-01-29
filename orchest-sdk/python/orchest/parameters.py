"""Module to interact with the parameter values of pipeline steps.

Parameters are stored in the corresponding pipeline definition file,
e.g. ``pipeline.orchest``.

"""
import json
from typing import Optional, Tuple

from orchest.config import Config
from orchest.error import StepUUIDResolveError
from orchest.pipeline import Pipeline
from orchest.utils import get_step_uuid


def get_params() -> Tuple[dict, dict]:
    """Gets the parameters of the current step and the pipeline.

    Returns:
        A tuple of two elements, where the first is the parameters of
        the current step, the second is the parameters of the pipeline.
    """
    with open(Config.PIPELINE_DEFINITION_PATH, "r") as f:
        pipeline_definition = json.load(f)

    pipeline = Pipeline.from_json(pipeline_definition)
    try:
        step_uuid = get_step_uuid(pipeline)
    except StepUUIDResolveError:
        raise StepUUIDResolveError("Parameters could not be identified.")

    step = pipeline.get_step_by_uuid(step_uuid)
    params = step.get_params()

    return params, pipeline.get_params()


def update_params(
    step_params: Optional[dict] = None, pipeline_params: Optional[dict] = None
) -> None:
    """Updates the parameters of the current step and of the pipeline.

    Additionally, you can set new parameters by giving parameters that
    do not yet exist in the current parameters, either of the step or of
    the pipeline.

    Internally the updating is done by calling the ``dict.update``
    method. This further explains the behavior of this method.

    Args:
        step_params: The step parameters to update. Either updating
            their values or adding new parameter keys.
        pipeline_params: The pipeline parameters to update. Either
            updating their values or adding new parameter keys.

    """
    with open(Config.PIPELINE_DEFINITION_PATH, "r") as f:
        pipeline_definition = json.load(f)

    pipeline = Pipeline.from_json(pipeline_definition)

    if pipeline_params is not None:
        pipeline.update_params(pipeline_params)

    if step_params is not None:
        try:
            step_uuid = get_step_uuid(pipeline)
        except StepUUIDResolveError:
            raise StepUUIDResolveError("Parameters could not be identified.")

        step = pipeline.get_step_by_uuid(step_uuid)
        step.update_params(step_params)

    with open(Config.PIPELINE_DEFINITION_PATH, "w") as f:
        json.dump(pipeline.to_dict(), f, indent=4, sort_keys=True)
