"""Transfer mechanisms to send and receive data from within steps."""
from datetime import datetime
import json
import os
import pickle
from typing import Any, Dict, List, Tuple
import urllib

from orchest.config import STEP_DATA_DIR
from orchest.errors import DiskInputNotFoundError
from orchest.pipeline import Pipeline


def _send_disk(data: Any,
               full_path: str,
               type: str = ' pickle',
               **kwargs) -> None:
    """Sends data to disk to the specified path.

    Args:
        data: data to send.
        full_path: full path to save the data to.
        type: file extension determining how to save the data to disk.
            Available options are one of: ["pickle",]
        **kwargs: kwargs to the function that handles writing data to
            disk for the specified `type`. For example:
            ``pickle.dump(data, fname, **kwargs)``

    Raises:
        ValueError: If `type` is not one of ["pickle",]
    """
    if type == 'pickle':
        with open(f'{full_path}.{type}', 'wb') as f:
            pickle.dump(data, f, **kwargs)
    else:
        raise ValueError("Function not defined for specified 'type'")

    return


def send_disk(data: Any, type: str = 'pickle', **kwargs) -> None:
    """Sends data to disk.

    To manage sending the data to disk for the user, this function has
    a side effect:
        * Writes to a HEAD file alongside the actual data file. This
          file serves a protocol that returns the timestamp of the
          latest write to disk via this function.

    Args:
        data: data to send.
        type: file extension determining how to save the data to disk.
            Available options are one of: ["pickle",]
        **kwargs: kwargs to the function that handles writing data to
            disk for the specified `type`. For example:
            ``pickle.dump(data, fname, **kwargs)``

    Example:
        >>> data = 'Data I would like to send'
        >>> send_disk(data)
    """
    with open('pipeline.json', 'r') as f:
        pipeline_description = json.load(f)

    pipeline = Pipeline.from_json(pipeline_description)
    step_uuid = get_step_uuid(pipeline)

    # Recursively create any directories if they do not already exists.
    step_data_dir = STEP_DATA_DIR.format(step_uuid=step_uuid)
    os.makedirs(step_data_dir, exist_ok=True)

    # The HEAD file serves to resolve the transfer method.
    head_file = os.path.join(step_data_dir, 'HEAD')
    with open(head_file, 'w') as f:
        f.write(f'{datetime.utcnow().isoformat()}, {type}')

    # Full path to write the actual data to.
    full_path = os.path.join(step_data_dir, step_uuid)

    return _send_disk(data, full_path, type=type, **kwargs)


def _receive_disk(full_path: str, type: str = 'pickle', **kwargs) -> Any:
    """Receives data from disk.

    Raises:
        ValueError: If `type` is not one of ["pickle",]
    """
    if type == 'pickle':
        with open(f'{full_path}.{type}', 'rb') as f:
            return pickle.load(f, **kwargs)

    raise ValueError("Function not defined for specified 'type'")


def receive_disk(step_uuid: str, type: str = 'pickle', **kwargs) -> Any:
    """Receives data from disk.

    Args:
        step_uuid: the UUID of the step from which to receive its data.
        type: file extension determining how to read the data from disk.
            Available options are one of: ["pickle",]

        **kwargs: kwargs to the function that handles reading data from
            disk for the specified `type`. For example:
            ``pickle.load(fname, **kwargs)``

    Raises:
        DiskInputNotFoundError: If input from step_uuid cannot be found.
    """
    step_data_dir = STEP_DATA_DIR.format(step_uuid=step_uuid)
    full_path = os.path.join(step_data_dir, step_uuid)

    try:
        return _receive_disk(full_path, type=type, **kwargs)
    except FileNotFoundError:
        # TODO: Ideally we want to provide the user with the step's
        #       name instead of UUID.
        raise DiskInputNotFoundError(
            f'Input from incoming step "{step_uuid}" cannot be found. '
            'Try rerunning it.'
        )


def resolve_disk(step_uuid: str) -> Dict[str, Any]:
    """Returns information of the most recent write to disk.

    Resolves via the HEAD file the timestamp (that is used to determine
    the most recent write) and arguments to call the :meth:`receive_disk`
    method.

    Args:
        step_uuid: the UUID of the step to resolve its most recent write
            to disk.

    Returns:
        Dictionary containing the information of the function to be
        called to receive the most recent data from the step.
        Additionally, returns fill-in arguments for the function.

    Raises:
        DiskInputNotFoundError: If input from step_uuid cannot be found.
    """
    step_data_dir = STEP_DATA_DIR.format(step_uuid=step_uuid)
    head_file = os.path.join(step_data_dir, 'HEAD')

    try:
        with open(head_file, 'r') as f:
            timestamp, type = f.read().split(', ')

    except FileNotFoundError:
        # TODO: Ideally we want to provide the user with the step's
        #       name instead of UUID.
        raise DiskInputNotFoundError(
            f'Input from incoming step "{step_uuid}" cannot be found. '
            'Try rerunning it.'
        )

    res = {
        'timestamp': timestamp,
        'method_to_call': receive_disk,
        'method_args': (),
        'method_kwargs': {
            'type': type
        }
    }
    return res


def resolve(step_uuid: str) -> Tuple[Any]:
    """Resolves the most recently used tranfer method of the given step.

    Args:
        step_uuid: UUID of the step to resolve its most recent write.

    Returns:
        Tuple containing the information of the function to be called
        to receive the most recent data from the step. Additionally,
        returns fill-in arguments for the function.
    """
    # TODO: not completely sure whether this global approach is prefered
    #       over difining that same list inside this function. Arguably
    #       defining it outside the function allows for easier
    #       extendability.
    global _receive_methods
    method_info = [method(step_uuid) for method in _receive_methods]

    # Get the method that was most recently used based on its logged
    # timestamp.
    most_recent = max(method_info, key=lambda x: x['timestamp'])
    return (most_recent['method_to_call'],
            most_recent['method_args'],
            most_recent['method_kwargs'])


def receive(pipeline_description_path: str = 'pipeline.json',
            verbose: bool = False) -> List[Any]:
    """Receives all data send from incoming steps.

    Args:
        pipeline_description_path: path to the pipeline description that
            is used to determine what the incoming steps are.
        verbose: if True print all the steps from which the current step
            has received data.

    Returns:
        List of all the data in the specified order from the front-end.

    Example:
        >>> data_step_1, data_step_2 = receive()
    """
    with open(pipeline_description_path, 'r') as f:
        pipeline_description = json.load(f)

    pipeline = Pipeline.from_json(pipeline_description)
    step_uuid = get_step_uuid(pipeline)

    data = []
    for parent in pipeline.get_step_by_uuid(step_uuid).parents:
        parent_uuid = parent.properties['uuid']
        receive_method, args, kwargs = resolve(parent_uuid)

        incoming_step_data = receive_method(parent_uuid, *args, **kwargs)

        if verbose:
            parent_title = parent.properties['title']
            print(f'Received input from step: "{parent_title}"')

        data.append(incoming_step_data)

    return data


# Idea for solution:
# - find kernel_id from ENV["KERNEL_ID"] that's populated by enterprise gateway
# - find kernel_id --> notebook filename through JupyterLab session
# - get JupyterLab /api/sessions access through orchest-api (:5000/launches)

def get_step_uuid(pipeline):
    # preferrably get step_uuid from ENV
    if "STEP_UUID" in os.environ:
        return os.environ["STEP_UUID"]

    # check if os environment variables KERNEL_ID and ORCHEST_API_ADDRESS are present
    if "ORCHEST_API_ADDRESS" not in os.environ:
        raise Exception(
            "ORCHEST_API_ADDRESS environment variable not available. Could not resolve step UUID.")
    if "KERNEL_ID" not in os.environ:
        raise Exception(
            "KERNEL_ID environment variable not available. Could not resolve step UUID.")

    # get JupyterLab session with token from ORCHEST_API
    url = "http://" + \
        os.environ["ORCHEST_API_ADDRESS"] + "/api/launches/" + pipeline.properties['uuid']

    launch_data = get_json(url)

    jupyter_api_url = "http://%s:%s/%s/api/sessions?token=%s" % (
        launch_data["server_ip"],
        launch_data["server_info"]["port"],
	"jupyter_" + launch_data["server_ip"].replace(".", "_"),
        launch_data["server_info"]["token"]
    )

    session_data = get_json(jupyter_api_url)

    notebook_path = ""

    for session in session_data:
        if session["kernel"]["id"] == os.environ["KERNEL_ID"]:
            notebook_path = session["notebook"]["path"]

    # TODO: these are not the type of errors we want to raise to our
    #       user. To them this is not descriptive at all.
    if notebook_path == "":
        raise Exception("Could not find KERNEL_ID in session data.")

    for step in pipeline.steps:
        if step.properties["file_path"] == notebook_path:

            # TODO: could decide to 'cache' the looked up UUID here through os.environ["STEP_UUID"]
            return step.properties["uuid"]

    raise Exception(
        "Could not find notebook_path %s in pipeline.json", (notebook_path,))


def get_json(url):
    try:
        r = urllib.request.urlopen(url)

        data = json.loads(r.read().decode(
            r.info().get_param('charset') or 'utf-8'))

        return data
    except (urllib.error.HTTPError, urllib.error.URLError) as e:
        print("Failed to fetch from: %s" % (url))
        print(e)


# NOTE: All "resolve_{method}" functions have to be included in this
# list.
_receive_methods = [
    resolve_disk,
]

# TODO: Once we are set on the API we could specify __all__. For now we
#       will stick with the leading _underscore convenction to keep
#       methods private.
