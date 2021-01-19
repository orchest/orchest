"""Module to interact with the parameter values of pipeline steps.

Parameters are stored in the corresponding pipeline definition file,
e.g. ``pipeline.orchest``.

"""
import json
from typing import Any, Dict

from orchest.config import Config
from orchest.error import StepUUIDResolveError
from orchest.pipeline import Pipeline
from orchest.utils import get_step_uuid


def get_params() -> Dict[str, Any]:
    """Gets the parameters of the current step.

    Returns:
        The parameters of the current step.
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

    return params


def update_params(params: Dict[str, Any]) -> None:
    """Updates the parameters of the current step.

    Additionally, you can set new parameters by giving parameters that
    do not yet exist in the current parameters of the pipeline step.

    Internally the updating is done by calling the ``dict.update``
    method. This further explains the behavior of this method.

    Args:
        params: The parameters to update. Either updating their values
            or adding new parameter keys.

    """
    with open(Config.PIPELINE_DEFINITION_PATH, "r") as f:
        pipeline_definition = json.load(f)

    pipeline = Pipeline.from_json(pipeline_definition)
    try:
        step_uuid = get_step_uuid(pipeline)
    except StepUUIDResolveError:
        raise StepUUIDResolveError("Parameters could not be identified.")

    step = pipeline.get_step_by_uuid(step_uuid)
    step.update_params(params)

    with open(Config.PIPELINE_DEFINITION_PATH, "w") as f:
        json.dump(pipeline.to_dict(), f, indent=4, sort_keys=True)
