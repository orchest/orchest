import json
import os
import urllib
from typing import Any, Dict

from orchest.config import Config
from orchest.error import OrchestNetworkError, StepUUIDResolveError
from orchest.pipeline import Pipeline


def get_step_uuid(pipeline: Pipeline) -> str:
    """Gets the currently running script's step UUID.

    Args:
        pipeline: Pipeline object describing the pipeline and its steps.

    Returns:
        The UUID of the currently running step. May it be through an
        active Jupyter kernel or as part of a partial run.

    Raises:
        StepUUIDResolveError: The step's UUID cannot be resolved.
    """
    # In case of partial runs, the step UUID can be obtained via the
    # environment.
    if "ORCHEST_STEP_UUID" in os.environ:
        return os.environ["ORCHEST_STEP_UUID"]

    # The KERNEL_ID environment variable is set by the Jupyter
    # Enterprise Gateway.
    kernel_id = os.environ.get("KERNEL_ID")
    if kernel_id is None:
        raise StepUUIDResolveError('Environment variable "KERNEL_ID" not present.')

    # Get JupyterLab sessions to resolve the step's UUID via the id of
    # the running kernel and the step's associated file path.  Orchest
    # API --jupyter_server_ip/port--> Jupyter sessions --notebook
    # path--> UUID.
    launches_url = (
        f"http://orchest-api/api/sessions/"
        f'{Config.PROJECT_UUID}/{pipeline.properties["uuid"]}'
    )
    launch_data = _request_json(launches_url)

    # NOTE: the `proxy_prefix` already includes the "/" at the start
    jupyter_api_url = "http://{ip}:{port}{proxy_prefix}/api/sessions"
    jupyter_api_url = jupyter_api_url.format(
        ip=launch_data["jupyter_server_ip"],
        port=launch_data["notebook_server_info"]["port"],
        proxy_prefix=launch_data["notebook_server_info"]["base_url"],
    )
    jupyter_sessions = _request_json(jupyter_api_url)

    for session in jupyter_sessions:
        if session["kernel"]["id"] == kernel_id:
            notebook_path = session["notebook"]["path"]
            break
    else:
        raise StepUUIDResolveError(
            'Jupyter session data has no "kernel" with "id" equal to the '
            f'"KERNEL_ID" of this step: {kernel_id}.'
        )

    for step in pipeline.steps:
        # Compare basenames, one pipeline can not have duplicate
        # notebook names, so this should work
        if os.path.basename(step.properties["file_path"]) == os.path.basename(
            notebook_path
        ):
            # NOTE: the UUID cannot be cached here. Because if the
            # notebook is assigned to a different step, then the env
            # variable does not change and thus the notebooks wrongly
            # thinks it is a different step.
            return step.properties["uuid"]

    raise StepUUIDResolveError(f'No step with "notebook_path": {notebook_path}.')


def get_pipeline() -> Pipeline:
    with open(Config.PIPELINE_DEFINITION_PATH, "r") as f:
        pipeline_definition = json.load(f)
    return Pipeline.from_json(pipeline_definition)


def _request_json(url: str) -> Dict[Any, Any]:
    """Requests response from specified url and jsonifies it."""
    try:
        with urllib.request.urlopen(url) as r:
            encoding = r.info().get_param("charset")
            data = r.read()
    except urllib.error.HTTPError:
        raise OrchestNetworkError(
            f"Failed to fetch data from {url}. The server could not fulfil the request."
        )
    except urllib.error.URLError:
        raise OrchestNetworkError(
            f"Failed to fetch data from {url}. Either the specified server "
            "does not exist or the network connection could not be established."
        )

    encoding = encoding or "utf-8"
    data = data.decode(encoding or "utf-8")

    return json.loads(data)
