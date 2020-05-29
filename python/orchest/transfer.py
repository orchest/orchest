"""Transfer mechanisms to send and receive data from within steps."""
from datetime import datetime
import json
import os
import pickle
import urllib

from orchest.errors import DiskInputNotFound
from orchest.pipeline import Pipeline


def _send_disk(data, full_path, type='pickle', **kwargs):
    """Sends data to disk to the specified path.

    Args:
        data:
        full_path:
        type: file extension.
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


def send_disk(data, type='pickle', **kwargs):
    """Sends data to disk.

    Something about the side effects? HEAD, step_data_dir.

    Args:
        data:
        type:
        **kwargs: kwargs to the function that handles writing data to
            disk for the specified `type`. For example:
            ``pickle.dump(data, fname, **kwargs)``
    """
    with open('pipeline.json', 'r') as f:
        pipeline_description = json.load(f)

    pipeline = Pipeline.from_json(pipeline_description)
    step_uuid = get_step_uuid(pipeline)

    # Recursively create any directories if they do not already exists.
    step_data_dir = f'.data/{step_uuid}'
    os.makedirs(step_data_dir, exist_ok=True)

    # The HEAD file serves to resolve the transfer method.
    head_file = os.path.join(step_data_dir, 'HEAD')
    with open(head_file, 'w') as f:
        f.write(f'{datetime.utcnow().isoformat()}, {type}')

    # Full path to write the actual data to.
    full_path = os.path.join(step_data_dir, step_uuid)

    return _send_disk(data, full_path, type=type, **kwargs)


def _receive_disk(full_path, type='pickle', **kwargs):
    if type == 'pickle':
        try:
            with open(f'{full_path}.{type}', 'rb') as f:
                data = pickle.load(f)

        except FileNotFoundError:
            # TODO: Ideally we want to provide the user with the step's
            #       name instead of UUID.
            step_uuid = os.path.split(full_path)[-1]
            raise DiskInputNotFound(
                f'Input from incoming step "{step_uuid}" cannot be found. '
                'Try rerunning it.'
            )

        return data

    raise ValueError("Function not defined for specified 'type'")


def receive_disk(step_uuid, type='pickle', **kwargs):
    """Receives data from disk.

    Args:
        **kwargs:
    """
    step_data_dir = f'.data/{step_uuid}'
    full_path = os.path.join(step_data_dir, step_uuid)

    return _receive_disk(full_path, type=type, **kwargs)


def resolve_disk(step_uuid):
    # TODO: The data dir is created in many functions. Can we make this
    #       more robust?
    step_data_dir = f'.data/{step_uuid}'

    head_file = os.path.join(step_data_dir, 'HEAD')
    try:
        with open(head_file, 'r') as f:
            timestamp, type = f.read().split(', ')

    except FileNotFoundError:
        # TODO: Ideally we want to provide the user with the step's
        #       name instead of UUID.
        raise DiskInputNotFound(
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


# TODO: Confusing name. It is not resolving what receive method to use
#       for the step_uuid. It is resolving how step_uuid has most
#       recently send data. It is resolving what receive method the
#       step_uuid's children should use. Maybe change back to "resolve"
def resolve_receive_method(step_uuid):
    # TODO: create this methods list dynamically. Or have it hardcoded
    #       in a GLOBAL instead of here in the function which allows for
    #       easier extendibility.
    # NOTE: All "resolve_{method}" functions have to be included in this
    # list.
    methods = [resolve_disk]
    method_info = [method(step_uuid) for method in methods]

    # Get the method that was most recently based on its logged
    # timestamp.
    most_recent = max(method_info, key=lambda x: x['timestamp'])
    return (most_recent['method_to_call'],
            most_recent['method_args'],
            most_recent['method_kwargs'])


def receive(verbose=False):
    with open('pipeline.json', 'r') as f:
        pipeline_description = json.load(f)

    pipeline = Pipeline.from_json(pipeline_description)
    step_uuid = get_step_uuid(pipeline)

    data = []
    # TODO: add to pipeline method: self.get_step_by_uuid(uuid). I
    #       forgot why. But one reason I can think of is getting the
    #       name once you have the PipelineStep object. Exactly this
    #       line requires this...
    for parent in pipeline.get_step_by_uuid(step_uuid).parents:
        parent_uuid = parent.properties['uuid']
        receive_method, args, kwargs = resolve_receive_method(parent_uuid)

        # Get data from the incoming step.
        incoming_step_data = receive_method(parent_uuid, *args, **kwargs)

        # TODO: Would be cool if parent_uuid was step_name instead.
        if verbose:
            print(f'Received input from step: {parent_uuid}')

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


# TODO: Once we are set on the API we could specify __all__. For now we
#       will stick with the leading _underscore convenction to keep
#       methods private.
