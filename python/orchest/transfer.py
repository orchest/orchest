"""Transfer mechanisms to send and receive data from within steps.

To add another transfer method

1. Create a new class that inherits from "Transferer" and implement its
   abstractmethods.
2. Define a module level function for sending and receiving data, e.g.
   ``send_disk(data, **kwargs)`` and ``receive_disk(**kwargs)``

"""
import abc
import json
import os
import pickle
import urllib

from orchest.pipeline import Pipeline


class Transferer(metaclass=abc.ABCMeta):
    # @classmethod
    # def __subclasshook_(cls, subclass):
    #     return (hasattr(subclass, 'save') and
    #             callable(subclass.load_data_source) and
    #             hasattr(subclass, 'receive') and
    #             callable(subclass.extract_text) or
    #             NotImplemented)

    @abc.abstractmethod
    def send(self, data, verbose=False):
        """Send output through step_uuid."""
        pass

    @abc.abstractmethod
    def receive(self, verbose=False):
        """Receive input through step_uuid."""
        pass


class DiskTransferer(Transferer):
    def send(self, pipeline, step_uuid, data, verbose=False):

        step_data_dir = ".data/%s" % (step_uuid)
        if not os.path.isdir(step_data_dir):
            os.makedirs(step_data_dir)

        with open(os.path.join(step_data_dir, "%s.pickle") % (step_uuid,), 'wb') as handle:
            pickle.dump(data, handle)

        if verbose:
            print("Saving %s to step_uuid %s" % (data, step_uuid))

    def receive(self, pipeline, step_uuid, verbose=False):

        step_data_dir = ".data/%s" % (step_uuid)

        data = []

        for incoming_step in pipeline.steps[step_uuid].properties["incoming_connections"]:

            pickle_path = ".data/%s/%s.pickle" % (incoming_step, incoming_step)

            if not os.path.isfile(pickle_path):

                raise Exception("No input available for step_uuid")

            else:
                with open(pickle_path, 'rb') as handle:
                    d = pickle.load(handle)
                    data.append(d)

        if verbose:
            print("Received inputs from steps %s" %
                (pipeline.steps[step_uuid].properties["incoming_connections"],))

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


def send_to_disk(data, **kwargs):
    pipeline = Pipeline()
    step_uuid = get_step_uuid(pipeline)

    transferer = DiskTransferer()
    transferer.send(pipeline, step_uuid, data, **kwargs)


def receive_from_disk(**kwargs):
    """Receives data from disk.

    Args:
        **kwargs
    """
    pipeline = Pipeline()
    step_uuid = get_step_uuid(pipeline)

    transferer = DiskTransferer()
    return transferer.receive(pipeline, step_uuid, **kwargs)


# TODO: Once we are set on the API we could specify __all__. For now we
#       will stick with the leading _underscore convenction to keep
#       methods private.
