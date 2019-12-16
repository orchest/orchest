from databoost import app, db
from flask import render_template, request, jsonify
from databoost import Pipeline
from .models import AlchemyEncoder
import json


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
