"""Module to interact with the parameter values of pipeline steps.

Handle to parameters that are stored in the corresponding pipeline
definition file, e.g. ``pipeline.orchest``.

"""
from typing import Any, Optional, Tuple

from orchest.error import StepUUIDResolveError
from orchest.pipeline import Pipeline, PipelineStep
from orchest.utils import get_pipeline, get_step_uuid


def _get_current_step(pipeline: Pipeline) -> PipelineStep:
    try:
        step_uuid = get_step_uuid(pipeline)
    except StepUUIDResolveError:
        raise StepUUIDResolveError("Parameters could not be identified.")
    return pipeline.get_step_by_uuid(step_uuid)


def get_params() -> Tuple[dict, dict]:
    """Gets the parameters of the current step and the pipeline.

    Returns:
        A tuple of two elements, where the first is the parameters of
        the current step, the second is the parameters of the pipeline.
    """
    pipeline = get_pipeline()
    step = _get_current_step(pipeline)
    return step.get_params(), pipeline.get_params()


def get_step_param(name: str, default: Optional[Any] = None) -> Any:
    """Gets a parameter of the current step by name.

    Args:
        name: The step parameter to get.

    Returns:
        The value that was mapped to the step parameter name.
    """
    pipeline = get_pipeline()
    step = _get_current_step(pipeline)
    params = step.get_params()
    return params.get(name, default)


def get_pipeline_param(name: str, default: Optional[Any] = None) -> Any:
    """Gets a pipeline parameter by name.

    Args:
        name: The pipeline parameter to get.

    Returns:
        The value that was mapped to the pipeline parameter name.
    """
    pipeline = get_pipeline()
    params = pipeline.get_params()
    return params.get(name, default)
