from ..pipeline import Pipeline
import pickle
import os
import json
import urllib

# Idea for solution:
# - find kernel_id from ENV["KERNEL_ID"] that's populated by enterprise gateway
# - find kernel_id --> notebook filename through JupyterLab session
# - get JupyterLab /api/sessions access through orchest-api (:5000/launches)

def get_step_uuid(pipeline):

    # check if os environment variables KERNEL_ID and ORCHEST_API_ADDRESS are present
    if "ORCHEST_API_ADDRESS" not in os.environ:
        raise Exception("ORCHEST_API_ADDRESS environment variable not available. Could not resolve step UUID.")
    if "KERNEL_ID" not in os.environ:
        raise Exception("KERNEL_ID environment variable not available. Could not resolve step UUID.")

    # get JupyterLab session with token from ORCHEST_API 
    url = "http://" + os.environ["ORCHEST_API_ADDRESS"] + "/api/launches/" + pipeline.uuid

    launch_data = get_json(url)

    jupyter_api_url = "http://%s:%s/api/sessions?token=%s" % (
        launch_data["server_ip"], 
        launch_data["server_info"]["port"], 
        launch_data["server_info"]["token"]
    )

    session_data = get_json(jupyter_api_url)

    notebook_path = ""

    for session in session_data:
        if session["kernel"]["id"] == os.environ["KERNEL_ID"]:
            notebook_path = session["notebook"]["path"]

    if notebook_path == "":
        raise Exception("Could not find KERNEL_ID in session data.")

    for step in pipeline.step_list():
        if step.properties["file_path"] == notebook_path:
            return step.properties["uuid"]
    
    raise Exception("Could not find notebook_path %s in pipeline.json", (notebook_path,))

def get_json(url):
    try:
        r = urllib.request.urlopen(url)

        data = json.loads(r.read().decode(r.info().get_param('charset') or 'utf-8'))

        return data
    except (urllib.error.HTTPError, urllib.error.URLError) as e:
        print("Failed to fetch from: %s" % (url))
        print(e)
    

def send(data):

    pipeline = Pipeline()

    step_uuid = get_step_uuid(pipeline)
    
    return step_uuid
    