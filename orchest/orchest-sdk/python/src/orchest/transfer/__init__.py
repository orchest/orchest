from ..pipeline import Pipeline
import pickle
import os


def get_step_uuid():
    pipeline = Pipeline()

    notebook_file_path = __file__

    for step_uuid in pipeline.steps.keys():
        if pipeline.steps[step_uuid].properties['file_path'] == notebook_file_path:
            return step_uuid
    
    raise Exception("Could not find Notebook file %s in working directory %s" % (notebook_file_path, os.getcwd()))

def send(data):

    step_uuid = get_step_uuid()
    
    # pickle.dump

    return step_uuid
    