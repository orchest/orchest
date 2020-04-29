from orchest import app, db
from flask import render_template, request, jsonify
from .models import AlchemyEncoder, Pipeline
from distutils.dir_util import copy_tree

import shutil
import json
import os
import uuid
import pdb

@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")


@app.route("/async/pipelines/delete/<pipeline_id>", methods=["POST"])
def pipelines_delete(pipeline_id):

    pipeline = Pipeline.query.filter_by(id=pipeline_id).first()

    # also delete directory
    pipeline_dir = get_pipeline_directory_by_uuid(pipeline.uuid)
    shutil.rmtree(pipeline_dir)

    db.session.delete(pipeline)
    db.session.commit()

    return jsonify({"success": True})


@app.route("/async/pipelines/create", methods=["POST"])
def pipelines_create():

    pipeline = Pipeline()
    pipeline.name = request.form.get("name")
    pipeline.uuid = str(uuid.uuid4())

    db.session.add(pipeline)
    db.session.commit()

    # create dirs
    pipeline_dir = get_pipeline_directory_by_uuid(pipeline.uuid)
    os.makedirs(pipeline_dir, exist_ok=True)

    # populate pipeline directory with kernels

    ## copy directories
    fromDirectory = os.path.join(app.config['RESOURCE_DIR'], "kernels/")
    toDirectory = os.path.join(pipeline_dir, ".kernels/")

    copy_tree(fromDirectory, toDirectory)

    ## replace variables in kernel.json files
    kernel_folders = [ f.path for f in os.scandir(toDirectory) if f.is_dir() ]

    for kernel_folder in kernel_folders:
        kernel_json_file = os.path.join(kernel_folder, "kernel.json")
        if os.path.isfile(kernel_json_file):
            with open(kernel_json_file, 'r') as file:
                data = file.read().replace('{host_pipeline_dir}', pipeline_dir)
                data = data.replace('{orchest_api_address}', app.config['ORCHEST_API_ADDRESS'])

            with open(kernel_json_file, 'w') as file:
                file.write(data)


    # generate clean pipeline.json

    pipeline_json = {
        "name": pipeline.name,
        "uuid": pipeline.uuid
    }

    with open(os.path.join(pipeline_dir, "pipeline.json"), 'w') as pipeline_json_file:
        pipeline_json_file.write(json.dumps(pipeline_json))

    return jsonify({"success": True})


@app.route("/async/pipelines/rename/<string:url_uuid>", methods=["POST"])
def pipelines_rename(url_uuid):

    pipeline = Pipeline.query.filter_by(uuid=url_uuid).first()

    if pipeline:

        # rename pipeline in DB
        pipeline.name = request.form.get("name")
        db.session.commit()

        # rename pipeline in JSON file
        pipeline_dir = get_pipeline_directory_by_uuid(pipeline.uuid)
        pipeline_json_path = os.path.join(pipeline_dir, "pipeline.json")

        with open(pipeline_json_path, 'r') as json_file:
            pipeline_json = json.load(json_file)

        pipeline_json["name"] = pipeline.name

        with open(pipeline_json_path, 'w') as json_file:
            json_file.write(json.dumps(pipeline_json))

        json_string = json.dumps({"success": True}, cls=AlchemyEncoder)
        return json_string, 200, {'content-type': 'application/json'}
    else:
        return "", 404


@app.route("/async/pipelines/get/<string:url_uuid>", methods=["GET"])
def pipelines_get_single(url_uuid):

    pipeline = Pipeline.query.filter_by(uuid=url_uuid).first()

    if pipeline:
        json_string = json.dumps({"success": True, "result": pipeline}, cls=AlchemyEncoder)
        return json_string, 200, {'content-type': 'application/json'}
    else:
        return "", 404


@app.route("/async/config", methods=["GET"])
def get_frontend_config():

    json_string = json.dumps({"success": True, "result": {
        "ORCHEST_API_ADDRESS": app.config["ORCHEST_API_ADDRESS"]
    }})

    return json_string, 200, {'content-type': 'application/json'}

@app.route("/async/pipelines/get_directory/<string:url_uuid>", methods=["GET"])
def pipelines_get_directory(url_uuid):
    json_string = json.dumps({"success": True, "result": get_pipeline_directory_by_uuid(url_uuid)}, cls=AlchemyEncoder)
    return json_string, 200, {'content-type': 'application/json'}


@app.route("/async/pipelines", methods=["GET"])
def pipelines_get():

    pipelines = Pipeline.query.all()

    json_string = json.dumps({"success": True, "result": pipelines}, cls=AlchemyEncoder)
    return json_string, 200, {'content-type': 'application/json'}


def get_pipeline_directory_by_uuid(uuid):

    pipeline_dir = os.path.join(app.config['ROOT_DIR'], "userdir/pipelines/" + uuid)

    # create pipeline dir if it doesn't exist
    os.makedirs(pipeline_dir, exist_ok=True)

    return pipeline_dir


def generate_ipynb_from_template(step):

    # TODO: support additional languages to Python and R
    if "python" in step["kernel"]["name"].lower():
        template_json = json.load(open(os.path.join(app.config['RESOURCE_DIR'], "ipynb_template.json"), "r"))
    else:
        template_json = json.load(open(os.path.join(app.config['RESOURCE_DIR'], "ipynb_template_r.json"), "r"))

    template_json["metadata"]["kernelspec"]["display_name"] = step["kernel"]["display_name"]
    template_json["metadata"]["kernelspec"]["name"] = step["kernel"]["name"]

    return json.dumps(template_json)


def create_pipeline_files(pipeline_json):

    pipeline_directory = get_pipeline_directory_by_uuid(pipeline_json["uuid"])

    # currently, we check per step whether the file exists. If not, we create it (empty by default).
    # In case the file has an .ipynb extension we generate the file from a template with a kernel based on the
    # kernel description in the JSON step.

    # iterate over steps
    steps = pipeline_json["steps"].keys()

    for key in steps:
        step = pipeline_json["steps"][key]

        file_name = step["file_path"]

        full_file_path = os.path.join(pipeline_directory, file_name)

        if not os.path.isfile(full_file_path):
            ext = file_name.split(".")[-1]

            file_content = ""

            if ext == "ipynb":
                file_content = generate_ipynb_from_template(step)

            file = open(full_file_path, "w")

            file.write(file_content)


@app.route("/async/pipelines/json/save", methods=["POST"])
def pipelines_json_save():

    pipeline_directory = get_pipeline_directory_by_uuid(request.form.get("pipeline_uuid"))

    # TODO: think properly about how to generate the pipeline files

    # parse JSON
    pipeline_json = json.loads(request.form.get("pipeline_json"))
    create_pipeline_files(pipeline_json)

    with open(os.path.join(pipeline_directory, "pipeline.json"), "w") as json_file:
        json_file.write(json.dumps(pipeline_json))

    return jsonify({"success": True})


def get_experiment_args_from_pipeline_json(pipeline_json):
    experiment_args = {}

    for key in pipeline_json['steps'].keys():
        step = pipeline_json['steps'][key]

        if len(step['experiment_json'].strip()) > 0:
            experiment_json = json.loads(step['experiment_json'])

            experiment_args[step['uuid']] = {
                "name": step['name'],
                "experiment_json": experiment_json
            }

    return experiment_args


@app.route("/async/pipelines/json/experiments/<pipeline_uuid>", methods=["GET"])
def pipelines_json_experiments_get(pipeline_uuid):

    pipeline_directory = get_pipeline_directory_by_uuid(pipeline_uuid)

    pipeline_json_path = os.path.join(pipeline_directory, "pipeline.json")
    if not os.path.isfile(pipeline_json_path):
        return jsonify({"success": False, "reason": "pipeline.json doesn't exist"})
    else:
        with open(pipeline_json_path) as json_file:

            pipeline_json = json.load(json_file)

            experiment_args = get_experiment_args_from_pipeline_json(pipeline_json)

            return jsonify({"success": True, "experiment_args": experiment_args})


@app.route("/async/pipelines/json/get/<pipeline_uuid>", methods=["GET"])
def pipelines_json_get(pipeline_uuid):

    pipeline_directory = get_pipeline_directory_by_uuid(pipeline_uuid)

    pipeline_json_path = os.path.join(pipeline_directory, "pipeline.json")
    if not os.path.isfile(pipeline_json_path):
        return jsonify({"success": False, "reason": "pipeline.json doesn't exist"})
    else:
        with open(pipeline_json_path) as json_file:
            return jsonify({"success": True, "pipeline_json": json_file.read()})
