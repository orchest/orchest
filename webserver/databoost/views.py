from databoost import app, db
from flask import render_template, request, jsonify

from databoost import Pipeline
from .models import AlchemyEncoder
import json
import os


@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")


@app.route("/async/pipelines/delete/<pipeline_id>", methods=["POST"])
def pipelines_delete(pipeline_id):

    Pipeline.query.filter(Pipeline.id == int(pipeline_id)).delete()
    db.session.commit()

    return jsonify({"success": True})


@app.route("/async/pipelines/create", methods=["POST"])
def pipelines_create():

    pipeline = Pipeline()
    pipeline.name = request.form.get("name")

    db.session.add(pipeline)
    db.session.commit()

    return jsonify({"success": True})


@app.route("/async/pipelines/get", methods=["GET"])
def pipelines_get():

    pipelines = Pipeline.query.all()

    json_string = json.dumps({"success:": True, "result": pipelines}, cls=AlchemyEncoder)
    return json_string, 200, {'content-type': 'application/json'}


def get_pipeline_directory_by_uuid(uuid):

    pipeline_dir = os.path.join(app.config['ROOT_DIR'], "userdir/pipelines/" + uuid)

    # create pipeline dir if it doesn't exist
    os.makedirs(pipeline_dir, exist_ok=True)

    return pipeline_dir


@app.route("/async/pipelines/json/save", methods=["POST"])
def pipelines_json_save():

    pipeline_directory = get_pipeline_directory_by_uuid(request.form.get("pipeline_uuid"))

    with open(os.path.join(pipeline_directory, "pipeline.json"), "w") as json_file:
        json_file.write(request.form.get("pipeline_json"))

    return jsonify({"success": True})


@app.route("/async/pipelines/json/get/<pipeline_uuid>", methods=["GET"])
def pipelines_json_get(pipeline_uuid):

    pipeline_directory = get_pipeline_directory_by_uuid(pipeline_uuid)

    with open(os.path.join(pipeline_directory, "pipeline.json")) as json_file:
        return jsonify({"success": True, "pipeline_json": json_file.read()})
