import json
import os
import uuid
import pdb
import requests
import logging
import nbformat

from flask import render_template, request, jsonify
from flask_restful import Api, Resource, HTTPException
from flask_marshmallow import Marshmallow
from distutils.dir_util import copy_tree
from nbconvert import HTMLExporter
from app.utils import get_hash
from app.models import DataSource, Experiment


logging.basicConfig(level=logging.DEBUG)



def register_views(app, db):

    def return_404(reason = ""):
        json_string = json.dumps(
            {"success": False, "reason": reason})

        return json_string, 404, {'content-type': 'application/json'}


    def generate_gateway_kernel_name(image, kernel):
        base_image = image
        # derive gateway kernel from kernel + image name
        # (dynamic instead of hardcoded mapping for now)
        # base image: i.e. jupyter/scipy-notebook gets reduced to scipy-notebook
        if "/" in base_image:
            base_image = base_image.replace("/", "-")

        return base_image + "_docker_" + kernel


    def pipeline_set_notebook_kernels(pipeline_json):

        # for each step set correct notebook kernel if it exists
        pipeline_directory = get_pipeline_directory_by_uuid(pipeline_json["uuid"])

        steps = pipeline_json["steps"].keys()

        for key in steps:
            step = pipeline_json["steps"][key]

            if "ipynb" == step["file_path"].split(".")[-1]:

                notebook_path = os.path.join(pipeline_directory, step["file_path"])

                if os.path.isfile(notebook_path):

                    gateway_kernel = generate_gateway_kernel_name(step['image'], step['kernel']['name'])

                    notebook_json = None

                    with open(notebook_path, "r") as file:
                        notebook_json = json.load(file)

                    notebook_json["metadata"]["kernelspec"]["name"] = gateway_kernel

                    with open(notebook_path, "w") as file:
                        file.write(json.dumps(notebook_json))
                else:
                    logging.debug("pipeline_set_notebook_kernels called on notebook_path that doesn't exist %s" % notebook_path)


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

    def get_pipeline_directory_by_uuid(uuid, host_path=False):

        pipeline_dir = os.path.join(get_pipelines_dir(host_path=host_path), uuid)

        return pipeline_dir


    def get_pipelines_dir(host_path=False):

        USER_DIR = app.config['USER_DIR']

        if host_path:
            USER_DIR = app.config['HOST_USER_DIR']

        pipeline_dir = os.path.join(USER_DIR, "pipelines")
        # create pipeline dir if it doesn't exist but only when not getting host path (that's not relative to this OS)
        if not host_path:
            os.makedirs(pipeline_dir, exist_ok=True)

        return pipeline_dir


    def generate_ipynb_from_template(step):

        # TODO: support additional languages to Python and R
        if "python" in step["kernel"]["name"].lower():
            template_json = json.load(
                open(os.path.join(app.config['RESOURCE_DIR'], "ipynb_template.json"), "r"))
        else:
            template_json = json.load(
                open(os.path.join(app.config['RESOURCE_DIR'], "ipynb_template_r.json"), "r"))

        template_json["metadata"]["kernelspec"]["display_name"] = step["kernel"]["display_name"]
        template_json["metadata"]["kernelspec"]["name"] = generate_gateway_kernel_name(step['image'], step["kernel"]["name"])

        return json.dumps(template_json)


    def create_pipeline_files(pipeline_json):

        pipeline_directory = get_pipeline_directory_by_uuid(pipeline_json["uuid"])

        # Currently, we check per step whether the file exists.
        # If not, we create it (empty by default).
        # In case the file has an .ipynb extension we generate the file from a
        # template with a kernel based on the kernel description in the JSON step.

        # Iterate over steps
        steps = pipeline_json["steps"].keys()

        for key in steps:
            step = pipeline_json["steps"][key]

            file_name = step["file_path"]

            full_file_path = os.path.join(pipeline_directory, file_name)

            if not os.path.isfile(full_file_path):
                file_name_split = file_name.split(".")
                file_name_without_ext = '.'.join(file_name_split[:-1])
                ext = file_name_split[-1]

                if len(file_name_without_ext) > 0:
                    file_content = ""

                    if ext == "ipynb":
                        file_content = generate_ipynb_from_template(step)

                    file = open(full_file_path, "w")

                    file.write(file_content)


    def create_experiment_directory(experiment_uuid, pipeline_uuid):
        
        experiment_path = os.path.join(app.config["USER_DIR"], "experiments", pipeline_uuid, experiment_uuid)

        os.makedirs(experiment_path)

        snapshot_path = os.path.join(experiment_path, "snapshot")
        pipeline_path = os.path.join(app.config["USER_DIR"], "pipelines", pipeline_uuid)

        os.system("cp -R %s %s" % (pipeline_path, snapshot_path))
        

    def register_datasources(db, api, ma):
        class DataSourceNameInUse(HTTPException):
            pass

        class DataSourceSchema(ma.Schema):
            class Meta:
                fields = ("name", "source_type", "connection_details")

        datasource_schema = DataSourceSchema()
        datasources_schema = DataSourceSchema(many=True)

        class DataSourcesResource(Resource):

            def get(self):
                datasources = DataSource.query.all()
                return datasources_schema.dump(datasources)


        class DataSourceResource(Resource):

            def put(self, name):

                ds = DataSource.query.filter(DataSource.name==name).first()
                ds.name = request.json["name"]
                ds.source_type = request.json["source_type"]
                ds.connection_details = request.json["connection_details"]
                db.session.commit()

                return datasource_schema.dump(ds)

            def get(self, name):
                ds = DataSource.query.filter(DataSource.name==name).first()
                return datasource_schema.dump(ds)

            def delete(self, name):
                DataSource.query.filter(DataSource.name==name).delete()
                db.session.commit()

            def post(self, name):

                if DataSource.query.filter(DataSource.name == name).count() > 0:
                    raise DataSourceNameInUse()

                new_ds = DataSource(
                    name=name,
                    source_type=request.json['source_type'],
                    connection_details=request.json['connection_details']
                )

                db.session.add(new_ds)
                db.session.commit()

                return datasource_schema.dump(new_ds)


        api.add_resource(DataSourcesResource, '/store/datasources')
        api.add_resource(DataSourceResource, '/store/datasources/<string:name>')


    def register_experiments(db, api, ma):

        class ExperimentUuidInUse(HTTPException):
            pass
        
        class ExperimentSchema(ma.Schema):
            class Meta:
                fields = ("name", "uuid", "pipeline_uuid", "pipeline_name", "created", "strategy_json", "draft")

        experiment_schema = ExperimentSchema()
        experiments_schema = ExperimentSchema(many=True)

        class ExperimentsResource(Resource):

            def get(self):
                experiments = Experiment.query.all()
                return experiments_schema.dump(experiments)

        class ExperimentResource(Resource):

            def put(self, experiment_uuid):

                ex = Experiment.query.filter(Experiment.uuid==uuid).first()
                ex.name = request.json["name"]
                ex.uuid = request.json["uuid"]
                ex.pipeline_uuid = request.json["pipeline_uuid"]
                ex.pipeline_name = request.json["pipeline_name"]
                ex.strategy_json = request.json["strategy_json"]
                ex.draft = request.json["draft"]
                db.session.commit()

                return experiment_schema.dump(ex)

            def get(self, experiment_uuid):
                ex = Experiment.query.filter(Experiment.uuid==experiment_uuid).first()
                return experiment_schema.dump(ex)

            def delete(self, experiment_uuid):
                Experiment.query.filter(Experiment.uuid==experiment_uuid).delete()
                db.session.commit()

            def post(self, experiment_uuid):

                if Experiment.query.filter(Experiment.uuid == experiment_uuid).count() > 0:
                    raise ExperimentUuidInUse()

                new_ex = Experiment(
                    uuid=experiment_uuid,
                    name=request.json['name'],
                    pipeline_uuid=request.json['pipeline_uuid'],
                    pipeline_name=request.json['pipeline_name'],
                    strategy_json=request.json['strategy_json'],
                    draft=request.json['draft'],
                )

                db.session.add(new_ex)
                db.session.commit()

                return experiment_schema.dump(new_ex)


        api.add_resource(ExperimentsResource, '/store/experiments')
        api.add_resource(ExperimentResource, '/store/experiments/<string:experiment_uuid>')


    def register_rest(app, db):

        ma = Marshmallow(app)

        errors = {
            'DataSourceNameInUse': {
                'message': "A data source with this name already exists.",
                'status': 409,
            },
            'ExperimentUuidInUse': {
                'message': "An experiment with this UUID already exists.",
                'status': 409,
            },
        }

        api = Api(app, errors = errors)

        register_datasources(db, api, ma)
        register_experiments(db, api, ma)

    register_rest(app, db)


    @app.route("/", methods=["GET"])
    def index():

        js_bundle_path = os.path.join(app.config["STATIC_DIR"], "js", "dist", "main.bundle.js")
        css_bundle_path = os.path.join(app.config["STATIC_DIR"], "css", "main.css")

        return render_template("index.html", javascript_bundle_hash = get_hash(js_bundle_path), css_bundle_hash = get_hash(css_bundle_path))


    @app.route("/catch/api-proxy/api/runs/", methods=["POST"])
    def catch_api_proxy_runs():

        json_obj = request.json

        # add image mapping
        # TODO: replace with dynamic mapping instead of hardcoded
        json_obj['run_config'] = {
            'runnable_image_mapping': app.config["IMAGE_MAPPING"],
            'pipeline_dir': get_pipeline_directory_by_uuid(json_obj['pipeline_description']['uuid'], host_path=True)
        }


        resp = requests.post(
            "http://" + app.config["ORCHEST_API_ADDRESS"] + "/api/runs/", json=json_obj, stream=True)

        return resp.raw.read(), resp.status_code, resp.headers.items()


    @app.route("/catch/api-proxy/api/experiments/", methods=["POST"])
    def catch_api_proxy_experiments():

        json_obj = request.json

        json_obj["pipeline_run_spec"]['run_config'] = {
            'runnable_image_mapping': app.config["IMAGE_MAPPING"],
            'host_user_dir': app.config["HOST_USER_DIR"]
        }

        resp = requests.post(
            "http://" + app.config["ORCHEST_API_ADDRESS"] + "/api/experiments/", json=json_obj, stream=True)

        return resp.raw.read(), resp.status_code, resp.headers.items()


    @app.route("/async/pipelines/delete/<pipeline_uuid>", methods=["POST"])
    def pipelines_delete(pipeline_uuid):

        # also delete directory
        pipeline_dir = get_pipeline_directory_by_uuid(pipeline_uuid)

        # TODO: find way to not force sudo remove on pipeline dirs
        # protection: should always be at least length of pipeline UUID, should be careful because of rm -rf command
        if len(pipeline_dir) > 36:
            os.system("rm -rf %s" % (pipeline_dir))

        return jsonify({"success": True})


    @app.route("/async/experiments/create", methods=["POST"])
    def experiments_create():
        
        create_experiment_directory(request.json['experiment_uuid'], request.json['pipeline_uuid'])
        
        return jsonify({"success": True})

    @app.route("/async/pipelines/create", methods=["POST"])
    def pipelines_create():

        pipeline_uuid = str(uuid.uuid4())

        # create dirs
        pipeline_dir = get_pipeline_directory_by_uuid(pipeline_uuid)

        os.makedirs(pipeline_dir, exist_ok=True)

        # populate pipeline directory with kernels

        # copy directories
        fromDirectory = os.path.join(app.config['RESOURCE_DIR'], "kernels")
        toDirectory = os.path.join(pipeline_dir, ".kernels")

        copy_tree(fromDirectory, toDirectory)

        # replace variables in kernel.json files
        kernel_folders = [f.path for f in os.scandir(toDirectory) if f.is_dir()]

        for kernel_folder in kernel_folders:
            kernel_json_file = os.path.join(kernel_folder, "kernel.json")
            if os.path.isfile(kernel_json_file):
                with open(kernel_json_file, 'r') as file:
                    data = file.read().replace('{host_pipeline_dir}', get_pipeline_directory_by_uuid(pipeline_uuid, host_path=True))
                    data = data.replace('{orchest_api_address}',
                                        app.config['ORCHEST_API_ADDRESS'])

                with open(kernel_json_file, 'w') as file:
                    file.write(data)

        # generate clean pipeline.json
        pipeline_json = {
            "name": request.form.get("name"),
            "uuid": pipeline_uuid,
            "version": "1.0.0"
        }

        with open(os.path.join(pipeline_dir, "pipeline.json"), 'w') as pipeline_json_file:
            pipeline_json_file.write(json.dumps(pipeline_json))

        return jsonify({"success": True})


    @app.route("/async/pipelines/rename/<string:pipeline_uuid>", methods=["POST"])
    def pipelines_rename(pipeline_uuid):

        pipeline_dir = get_pipeline_directory_by_uuid(pipeline_uuid)

        if os.path.isdir(pipeline_dir) and os.path.isfile(os.path.join(pipeline_dir, "pipeline.json")):

            # rename pipeline in JSON file
            pipeline_json_path = os.path.join(pipeline_dir, "pipeline.json")

            with open(pipeline_json_path, 'r') as json_file:
                pipeline_json = json.load(json_file)

            pipeline_json["name"] = request.form.get("name")

            with open(pipeline_json_path, 'w') as json_file:
                json_file.write(json.dumps(pipeline_json))

            json_string = json.dumps({"success": True})
            return json_string, 200, {'content-type': 'application/json'}
        else:
            return "", 404


    @app.route("/async/pipelines/get/<string:pipeline_uuid>", methods=["GET"])
    def pipelines_get_single(pipeline_uuid):

        pipeline_dir = get_pipeline_directory_by_uuid(pipeline_uuid)
        pipeline_json_path = os.path.join(pipeline_dir, "pipeline.json")

        if os.path.isfile(pipeline_json_path):

            with open(pipeline_json_path, 'r') as json_file:
                pipeline_json = json.load(json_file)

                pipeline_light = {
                    "name": pipeline_json["name"],
                    "uuid": pipeline_json["uuid"]
                }
                json_string = json.dumps(
                    {"success": True, "result": pipeline_light})
                return json_string, 200, {'content-type': 'application/json'}
        else:
            return "", 404


    @app.route("/async/pipelines/get_directory/<string:pipeline_uuid>", methods=["GET"])
    def pipelines_get_directory(pipeline_uuid):
        json_string = json.dumps({"success": True, "result": get_pipeline_directory_by_uuid(
            pipeline_uuid, host_path=True)})
        return json_string, 200, {'content-type': 'application/json'}


    @app.route("/async/pipelines", methods=["GET"])
    def pipelines_get():

        pipelines_dir = get_pipelines_dir()

        pipeline_uuids = [ f.path for f in os.scandir(pipelines_dir) if f.is_dir() ]

        pipelines = []

        for pipeline_uuid in pipeline_uuids:

            pipeline_json_path = os.path.join(pipelines_dir, pipeline_uuid, "pipeline.json")

            if os.path.isfile(pipeline_json_path):
                with open(pipeline_json_path, 'r') as json_file:
                    pipeline_json = json.load(json_file)

                    pipelines.append({
                        "name": pipeline_json["name"],
                        "uuid": pipeline_json["uuid"]
                    })

        json_string = json.dumps(
            {"success": True, "result": pipelines})
        return json_string, 200, {'content-type': 'application/json'}


    @app.route("/async/notebook_html/<string:pipeline_uuid>/<string:step_uuid>", methods=["GET"])
    def notebook_html_get(pipeline_uuid, step_uuid):

        pipeline_dir = get_pipeline_directory_by_uuid(pipeline_uuid)

        pipeline_json_path = os.path.join(pipeline_dir, "pipeline.json")

        if os.path.isfile(pipeline_json_path):
            with open(pipeline_json_path, 'r') as json_file:
                pipeline_json = json.load(json_file)

            try:
                notebook_path = os.path.join(pipeline_dir, pipeline_json["steps"][step_uuid]["file_path"])
            except Exception as e:
                logging.debug(e)
                return return_404("Invalid JSON for pipeline %s error: %e" % (pipeline_uuid, e))
        else:
            return return_404("Could not find pipeline.json for pipeline %s" % pipeline_uuid)


        if os.path.isfile(notebook_path):
            try:

                with open(notebook_path, 'r') as file:
                    nb = nbformat.read(file, nbformat.NO_CONVERT)

                html_exporter = HTMLExporter()
                html_exporter.template_file = 'full'

                (body, resources) = html_exporter.from_notebook_node(nb)

                return body

            except IOError as error:
                logging.debug("Error opening notebook file %s error: %s" % (notebook_path, error))
                return return_404("Could not find notebook file %s" % notebook_path)


    @app.route("/async/logs/<string:pipeline_uuid>/<string:step_uuid>", methods=["GET"])
    def logs_get(pipeline_uuid, step_uuid):

        pipeline_dir = get_pipeline_directory_by_uuid(pipeline_uuid)

        log_path = os.path.join(pipeline_dir, app.config["LOG_DIR"], "%s.log" % step_uuid)

        logs = None

        if os.path.isfile(log_path):
            try:

                with open(log_path, 'r') as f:
                    logs = f.read()

            except IOError as error:
                logging.debug("Error opening log file %s error: %s" % (log_path, error))

        if logs is not None:
            json_string = json.dumps(
            {"success": True, "result": logs})

            return json_string, 200, {'content-type': 'application/json'}

        else:
            json_string = json.dumps(
            {"success": False, "reason": "Could not find log file"})

            return json_string, 404, {'content-type': 'application/json'}


    @app.route("/async/pipelines/json/save", methods=["POST"])
    def pipelines_json_save():

        pipeline_directory = get_pipeline_directory_by_uuid(
            request.form.get("pipeline_uuid"))

        # parse JSON
        pipeline_json = json.loads(request.form.get("pipeline_json"))
        create_pipeline_files(pipeline_json)

        # side effect: for each Notebook in de pipeline.json set the correct kernel
        pipeline_set_notebook_kernels(pipeline_json)

        with open(os.path.join(pipeline_directory, "pipeline.json"), "w") as json_file:
            json_file.write(json.dumps(pipeline_json))

        return jsonify({"success": True})


    @app.route("/async/pipelines/json/experiments/<pipeline_uuid>", methods=["GET"])
    def pipelines_json_experiments_get(pipeline_uuid):

        pipeline_directory = get_pipeline_directory_by_uuid(pipeline_uuid)

        pipeline_json_path = os.path.join(pipeline_directory, "pipeline.json")
        if not os.path.isfile(pipeline_json_path):
            return jsonify({"success": False, "reason": "pipeline.json doesn't exist"}), 404
        else:
            with open(pipeline_json_path) as json_file:

                pipeline_json = json.load(json_file)

                experiment_args = get_experiment_args_from_pipeline_json(
                    pipeline_json)

                return jsonify({"success": True, "experiment_args": experiment_args})


    @app.route("/async/pipelines/json/get/<pipeline_uuid>", methods=["GET"])
    def pipelines_json_get(pipeline_uuid):

        pipeline_directory = get_pipeline_directory_by_uuid(pipeline_uuid)

        pipeline_json_path = os.path.join(pipeline_directory, "pipeline.json")
        if not os.path.isfile(pipeline_json_path):
            return jsonify({"success": False, "reason": "pipeline.json doesn't exist"}), 404
        else:
            with open(pipeline_json_path) as json_file:
                return jsonify({"success": True, "pipeline_json": json_file.read()})
