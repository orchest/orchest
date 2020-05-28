"""Transfer mechanisms to send and receive data from within steps.

To add another transfer method

1. Create a new class that inherits from "Transferer" and implement its
   abstractmethods.
2. Define a module level function for sending and receiving data, e.g.
   ``send_disk(data, **kwargs)`` and ``receive_disk(**kwargs)``

"""
import json
import os
import pickle
import urllib

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

    Args:
        data:
        type:
        **kwargs: kwargs to the function that handles writing data to
            disk for the specified `type`. For example:
            ``pickle.dump(data, fname, **kwargs)``
    """
    pipeline = Pipeline()
    step_uuid = get_step_uuid(pipeline)

    # Set the full path to write the data to and recursively create any
    # directories if they do not already exists.
    step_data_dir = f'.data/{step_uuid}'
    os.makedirs(step_data_dir, exist_ok=True)
    full_path = os.path.join(step_data_dir, step_uuid)

    return _send_disk(data, full_path, type=type, **kwargs)


def _receive_disk(full_path, type='pickle', **kwargs):
    if type == 'pickle':
        try:
            with open(f'{full_path}.{type}', 'rb') as f:
                data = pickle.load(f)

        except FileNotFoundError as e:
            # TODO: Ideally we want to provide the user with the step's
            #       name instead of UUID.
            step_uuid = os.path.split(full_path)[-1]
            custom_message = f'Step "{step_uuid}" did not produce any output.'
            raise FileNotFoundError(custom_message, e)

        return data

    raise ValueError("Function not defined for specified 'type'")


def receive_disk(step_uuid, type='pickle', **kwargs):
    """Receives data from disk.

    Args:
        **kwargs
    """
    step_data_dir = f'.data/{step_uuid}'
    full_path = os.path.join(step_data_dir, step_uuid)

    return _receive_disk(full_path, type=type, **kwargs)


def resolve_disk(step_uuid):
    # TODO: check within the HEAD file
    type = 'pickle'
    timestamp = 10  # TODO: some valid time

    res = {
        'timestamp': timestamp,
        'method_to_call': receive_disk,
        'method_args': (),
        'method_kwargs': {
            'type': type
        }
    }
    return res


def resolve(step_uuid):
    # TODO: check all methods and return which one should be used.
    methods = [resolve_disk]
    method_info = [method(step_uuid) for method in methods]

    # Get the method that was most recently based on its logged
    # timestamp.
    most_recent = max(method_info, key=lambda x: x['timestamp'])
    return (most_recent['method_to_call'],
            most_recent['method_args'],
            most_recent['method_kwargs'])


def receive(verbose=False):
    pipeline = Pipeline()
    step_uuid = get_step_uuid(pipeline)

    data = []
    # TODO: add to pipeline method: self.get_step_by_uuid(uuid). I
    #       forgot why. But one reason I can think of is getting the
    #       name once you have the PipelineStep object.
    for incoming_step in pipeline.steps[step_uuid].properties['incoming_connections']:
        # TODO: resolve what method should be called! Thus receive_disk
        #       or receive_memory.
        step_uuid = incoming_step
        receive_method, args, kwargs = resolve(step_uuid)

        # Get data.
        incoming_step_data = receive_method(step_uuid, *args, **kwargs)

        # TODO: Would be cool if step_uuid was step_name instead.
        if verbose:
            print(f'Received input from step: {step_uuid}')

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
        os.environ["ORCHEST_API_ADDRESS"] + "/api/launches/" + pipeline.uuid

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

    for step in pipeline.step_list():
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
