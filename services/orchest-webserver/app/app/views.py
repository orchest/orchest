import json
import os
import uuid
import pdb
import requests
import logging
import nbformat
import docker
import subprocess

from sqlalchemy.sql.expression import not_
from flask import render_template, request, jsonify
from flask_restful import Api, Resource, HTTPException
from flask_marshmallow import Marshmallow
from distutils.dir_util import copy_tree
from nbconvert import HTMLExporter
from app.utils import get_hash, get_user_conf, get_user_conf_raw, save_user_conf_raw, name_to_tag, get_synthesized_images
from app.models import DataSource, Experiment, PipelineRun, Image, Commit
from app.kernel_manager import populate_kernels
from _orchest.internals import config as _config
from _orchest.internals.utils import orchest_ctl


logging.basicConfig(level=logging.DEBUG)


def register_views(app, db):

    ma = Marshmallow(app)

    class DataSourceNameInUse(HTTPException):
        pass

    class DataSourceSchema(ma.Schema):
        class Meta:
            fields = ("name", "source_type", "connection_details")

    datasource_schema = DataSourceSchema()
    datasources_schema = DataSourceSchema(many=True)

    class CommitNameInUse(HTTPException):
        pass

    class CommitSchema(ma.Schema):
        class Meta:
            fields = ("name", "tag", "base_image", "uuid", "building")

    commit_schema = CommitSchema()
    commits_schema = CommitSchema(many=True)

    class ImageNameInUse(HTTPException):
        pass

    class ImageSchema(ma.Schema):
        class Meta:
            fields = ("name", "language")

    image_schema = ImageSchema()
    images_schema = ImageSchema(many=True)


    class ExperimentUuidInUse(HTTPException):
        pass


    class ExperimentSchema(ma.Schema):
        class Meta:
            fields = ("name", "uuid", "pipeline_uuid",
                      "pipeline_name", "created", "strategy_json", "draft")

    experiment_schema = ExperimentSchema()
    experiments_schema = ExperimentSchema(many=True)

    def return_404(reason=""):
        json_string = json.dumps(
            {"success": False, "reason": reason})

        return json_string, 404, {"content-type": "application/json"}


    def generate_gateway_kernel_name(image, kernel):
        base_image = image
        # derive gateway kernel from kernel + image name
        # (dynamic instead of hardcoded mapping for now)
        # base image: i.e. jupyter/scipy-notebook gets reduced to scipy-notebook
        if "/" in base_image:
            base_image = base_image.replace("/", "-")

        return base_image


    def pipeline_set_notebook_kernels(pipeline_json):

        # for each step set correct notebook kernel if it exists
        pipeline_directory = get_pipeline_directory_by_uuid(
            pipeline_json["uuid"])

        steps = pipeline_json["steps"].keys()

        for key in steps:
            step = pipeline_json["steps"][key]

            if "ipynb" == step["file_path"].split(".")[-1]:

                notebook_path = os.path.join(
                    pipeline_directory, step["file_path"])

                if os.path.isfile(notebook_path):

                    gateway_kernel = generate_gateway_kernel_name(
                        step["image"], step["kernel"]["name"])

                    notebook_json = None

                    with open(notebook_path, "r") as file:
                        notebook_json = json.load(file)

                    if notebook_json["metadata"]["kernelspec"]["name"] != gateway_kernel:
                        notebook_json["metadata"]["kernelspec"]["name"] = gateway_kernel

                        with open(notebook_path, "w") as file:
                            file.write(json.dumps(notebook_json))
                            
                else:
                    logging.info(
                        "pipeline_set_notebook_kernels called on notebook_path that doesn't exist %s" % notebook_path)


    def get_experiment_args_from_pipeline_json(pipeline_json):
        experiment_args = {}

        for key in pipeline_json["steps"].keys():
            step = pipeline_json["steps"][key]

            if len(step["experiment_json"].strip()) > 0:
                experiment_json = json.loads(step["experiment_json"])

                experiment_args[step["uuid"]] = {
                    "name": step["name"],
                    "experiment_json": experiment_json
                }

        return experiment_args


    def get_pipeline_directory_by_uuid(uuid, host_path=False, pipeline_run_uuid=None):

        pipelines_dir = get_pipelines_dir(
            host_path=host_path, pipeline_run_uuid=pipeline_run_uuid)

        if pipeline_run_uuid is None:
            pipeline_dir = os.path.join(pipelines_dir, uuid)
        else:
            pipeline_dir = os.path.join(pipelines_dir, pipeline_run_uuid)

        return pipeline_dir


    def get_pipelines_dir(host_path=False, pipeline_run_uuid=None):

        USER_DIR = app.config["USER_DIR"]

        if host_path:
            USER_DIR = app.config["HOST_USER_DIR"]

        if pipeline_run_uuid is None:
            pipeline_dir = os.path.join(USER_DIR, "pipelines")
        else:
            pipeline_run = PipelineRun.query.filter(
                PipelineRun.uuid == pipeline_run_uuid).first()

            experiment = Experiment.query.filter(Experiment.uuid == pipeline_run.experiment).first()
            pipeline_dir = os.path.join(
                USER_DIR, "experiments", experiment.pipeline_uuid, pipeline_run.experiment)

        # create pipeline dir if it doesn't exist but only when not getting host path (that's not relative to this OS)
        if not host_path:
            os.makedirs(pipeline_dir, exist_ok=True)

        return pipeline_dir


    def generate_ipynb_from_template(step):

        # TODO: support additional languages to Python and R
        if "python" in step["kernel"]["name"].lower():
            template_json = json.load(
                open(os.path.join(app.config["RESOURCE_DIR"], "ipynb_template.json"), "r"))
        else:
            template_json = json.load(
                open(os.path.join(app.config["RESOURCE_DIR"], "ipynb_template_r.json"), "r"))

        template_json["metadata"]["kernelspec"]["display_name"] = step["kernel"]["display_name"]
        template_json["metadata"]["kernelspec"]["name"] = generate_gateway_kernel_name(
            step["image"], step["kernel"]["name"])

        return json.dumps(template_json)


    def create_pipeline_files(pipeline_json):

        pipeline_directory = get_pipeline_directory_by_uuid(
            pipeline_json["uuid"])

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
                file_name_without_ext = ".".join(file_name_split[:-1])
                ext = file_name_split[-1]

                if len(file_name_without_ext) > 0:
                    file_content = ""

                    if ext == "ipynb":
                        file_content = generate_ipynb_from_template(step)

                    file = open(full_file_path, "w")

                    file.write(file_content)


    def create_experiment_directory(experiment_uuid, pipeline_uuid):
        experiment_path = os.path.join(
            app.config["USER_DIR"], "experiments", pipeline_uuid, experiment_uuid)
        os.makedirs(experiment_path)
        snapshot_path = os.path.join(experiment_path, "snapshot")
        pipeline_path = os.path.join(
            app.config["USER_DIR"], "pipelines", pipeline_uuid)
        os.system("cp -R %s %s" % (pipeline_path, snapshot_path))


    def remove_experiment_directory(experiment_uuid, pipeline_uuid):
        experiment_pipeline_path = os.path.join(
            app.config["USER_DIR"], "experiments", pipeline_uuid)
        experiment_path = os.path.join(
            experiment_pipeline_path, experiment_uuid)

        if os.path.isdir(experiment_path):
            os.system("rm -r %s" % (experiment_path))

        # remove pipeline directory if empty
        if os.path.isdir(experiment_pipeline_path) and not os.listdir(experiment_pipeline_path):
            os.system("rm -r %s" % (experiment_pipeline_path))


    def remove_commit_image(commit):
        full_image_name = '%s:%s' % (commit.base_image, commit.tag)
        try:
            client = docker.from_env()
            client.images.remove(full_image_name, noprune=True)
        except:
            logging.info("Unable to remove image: %s" % full_image_name)


    def remove_commit_shell(commit):

        shell_file_dir = os.path.join(app.config["USER_DIR"], ".orchest", "commits", commit.uuid)
        
        if os.path.isdir(shell_file_dir):
            os.system("rm -r %s" % (shell_file_dir))

    def register_commits(db, api, ma):

        class CommitsResource(Resource):

            def get(self):
                if 'image_name' in request.args:
                    commits = Commit.query.filter(Commit.base_image == request.args['image_name']).all()
                else:
                    commits = Commit.query.all()
                    
                return commits_schema.dump(commits)

        class CommitResource(Resource):

            def put(self, commit_uuid):

                commit = Commit.query.filter(Commit.uuid==commit_uuid).first()
                
                if commit is None:
                    return '', 404

                commit.name = request.json["name"]
                commit.tag = name_to_tag(request.json["name"])
                commit.base_image = request.json["image_name"]
                
                db.session.commit()

                # side effect: update shared kernels directory
                populate_kernels(app, db)

                return commit_schema.dump(commit)

            def get(self, commit_uuid):
                commit = Commit.query.filter(Commit.uuid==commit_uuid).first()
                return commit_schema.dump(commit)

            def delete(self, commit_uuid):

                commit = Commit.query.filter(Commit.uuid==commit_uuid).first()

                if commit is None:
                    return '', 404

                remove_commit_shell(commit)
                remove_commit_image(commit)

                db.session.delete(commit)
                db.session.commit()

                # side effect: update shared kernels directory
                populate_kernels(app, db)

            # note that the post request accepts the name instead of the tag
            def post(self, commit_uuid):
                
                name = request.json["name"]
                tag = name_to_tag(name)
                image_name = request.json["image_name"]

                if Commit.query.filter(Commit.base_image.name == image_name).filter(Commit.tag == tag).count() > 0:
                    raise CommitNameInUse()

                # check image_name exists as a constraint
                if Image.query.filter(Image.name == image_name).count() == 0:
                    return '', 404

                new_commit = Commit(
                    uuid=str(uuid.uuid4()),
                    name=name,
                    tag=tag,
                    base_image=image_name
                )

                db.session.add(new_commit)
                db.session.commit()

                # side effect: update shared kernels directory
                populate_kernels(app, db)

                return commit_schema.dump(new_commit)

        api.add_resource(CommitsResource, "/store/commits")
        api.add_resource(CommitResource,
                         "/store/commits/<string:commit_uuid>")


    def register_images(db, api, ma):

        class ImagesResource(Resource):

            def get(self):
                images = Image.query.all()
                return images_schema.dump(images)

        class ImageResource(Resource):

            def put(self, name):

                im = Image.query.filter(Image.name == name).first()

                if im is None:
                    return '', 404

                im.name = request.json["name"]
                im.language = request.json["language"]
                db.session.commit()

                return image_schema.dump(im)

            def get(self, name):
                im = Image.query.filter(Image.name == name).first()

                if im is None:
                    return '', 404

                return image_schema.dump(im)

            def delete(self, name):
                Image.query.filter(Image.name == name).delete()
                db.session.commit()

            def post(self, name):

                if Image.query.filter(Image.name == name).count() > 0:
                    raise ImageNameInUse()

                new_im = Image(
                    name=name,
                    language=request.json["language"]
                )

                db.session.add(new_im)
                db.session.commit()

                return image_schema.dump(new_im)

        api.add_resource(ImagesResource, "/store/images")
        api.add_resource(ImageResource,
                         "/store/images/<string:name>")


    def register_datasources(db, api, ma):

        class DataSourcesResource(Resource):

            def get(self):

                show_internal = True
                if request.args.get("show_internal") == "false":
                    show_internal = False

                if show_internal:
                    datasources = DataSource.query.all()
                else:
                    datasources = DataSource.query.filter(not_(DataSource.name.startswith('_'))).all()
                
                return datasources_schema.dump(datasources)

        class DataSourceResource(Resource):

            def put(self, name):
                ds = DataSource.query.filter(DataSource.name == name).first()

                if ds is None:
                    return '', 404

                ds.name = request.json["name"]
                ds.source_type = request.json["source_type"]
                ds.connection_details = request.json["connection_details"]
                db.session.commit()

                return datasource_schema.dump(ds)

            def get(self, name):
                ds = DataSource.query.filter(DataSource.name == name).first()

                if ds is None:
                    return '', 404

                return datasource_schema.dump(ds)

            def delete(self, name):
                ds = DataSource.query.filter(DataSource.name == name).first()

                if ds is None:
                    return '', 404

                db.session.delete(ds)
                db.session.commit()

            def post(self, name):
                if DataSource.query.filter(DataSource.name == name).count() > 0:
                    raise DataSourceNameInUse()

                new_ds = DataSource(
                    name=name,
                    source_type=request.json["source_type"],
                    connection_details=request.json["connection_details"]
                )

                db.session.add(new_ds)
                db.session.commit()

                return datasource_schema.dump(new_ds)

        api.add_resource(DataSourcesResource, "/store/datasources")
        api.add_resource(DataSourceResource,
                         "/store/datasources/<string:name>")


    def register_experiments(db, api, ma):

        class ExperimentsResource(Resource):

            def get(self):
                experiments = Experiment.query.all()
                return experiments_schema.dump(experiments)

        class ExperimentResource(Resource):

            def put(self, experiment_uuid):

                ex = Experiment.query.filter(
                    Experiment.uuid == experiment_uuid).first()

                if ex is None:
                    return '', 404

                ex.name = request.json["name"]
                ex.pipeline_uuid = request.json["pipeline_uuid"]
                ex.pipeline_name = request.json["pipeline_name"]
                ex.strategy_json = request.json["strategy_json"]
                ex.draft = request.json["draft"]

                db.session.commit()

                return experiment_schema.dump(ex)

            def get(self, experiment_uuid):
                ex = Experiment.query.filter(
                    Experiment.uuid == experiment_uuid).first()

                if ex is None:
                    return '', 404

                return experiment_schema.dump(ex)

            def delete(self, experiment_uuid):

                # remove experiment directory
                ex = Experiment.query.filter(
                    Experiment.uuid == experiment_uuid).first()

                if ex is None:
                    return '', 404

                remove_experiment_directory(ex.uuid, ex.pipeline_uuid)

                db.session.delete(ex)
                db.session.commit()

                return jsonify({"message": "Experiment termination was successful"})

            def post(self, experiment_uuid):

                if Experiment.query.filter(Experiment.uuid == experiment_uuid).count() > 0:
                    raise ExperimentUuidInUse()

                new_ex = Experiment(
                    uuid=experiment_uuid,
                    name=request.json["name"],
                    pipeline_uuid=request.json["pipeline_uuid"],
                    pipeline_name=request.json["pipeline_name"],
                    strategy_json=request.json["strategy_json"],
                    draft=request.json["draft"],
                )

                db.session.add(new_ex)
                db.session.commit()

                return experiment_schema.dump(new_ex)

        api.add_resource(ExperimentsResource, "/store/experiments")
        api.add_resource(ExperimentResource,
                         "/store/experiments/<string:experiment_uuid>")


    def register_rest(app, db):

        errors = {
            "CommitNameInUse": {
                "message": "A commit with this name for this base image already exists.",
                "status": 409,
            },
            "ImageNameInUse": {
                "message": "An image with this name already exists.",
                "status": 409,
            },
            "DataSourceNameInUse": {
                "message": "A data source with this name already exists.",
                "status": 409,
            },
            "ExperimentUuidInUse": {
                "message": "An experiment with this UUID already exists.",
                "status": 409,
            },
        }

        api = Api(app, errors=errors)

        register_datasources(db, api, ma)
        register_experiments(db, api, ma)
        register_images(db, api, ma)
        register_commits(db, api, ma)

    register_rest(app, db)


    @app.route("/", methods=["GET"])
    def index():

        js_bundle_path = os.path.join(
            app.config["STATIC_DIR"], "js", "dist", "main.bundle.js")
        css_bundle_path = os.path.join(
            app.config["STATIC_DIR"], "css", "main.css")
            

        return render_template("index.html", javascript_bundle_hash=get_hash(js_bundle_path), css_bundle_hash=get_hash(css_bundle_path), user_config=get_user_conf(), FLASK_ENV=app.config["FLASK_ENV"])


    @app.route("/catch/api-proxy/api/runs/", methods=["POST"])
    def catch_api_proxy_runs():

        json_obj = request.json

        # add image mapping
        # TODO: replace with dynamic mapping instead of hardcoded
        json_obj["run_config"] = {
            "pipeline_dir": get_pipeline_directory_by_uuid(json_obj["pipeline_description"]["uuid"], host_path=True)
        }

        resp = requests.post(
            "http://" + app.config["ORCHEST_API_ADDRESS"] + "/api/runs/", json=json_obj, stream=True)

        return resp.raw.read(), resp.status_code, resp.headers.items()


    @app.route("/catch/api-proxy/api/sessions/", methods=["POST"])
    def catch_api_proxy_sessions():

        json_obj = request.json

        json_obj["pipeline_dir"] = get_pipeline_directory_by_uuid(
            request.json["pipeline_uuid"], host_path=True)
        json_obj["host_userdir"] = app.config["HOST_USER_DIR"]

        resp = requests.post(
            "http://" + app.config["ORCHEST_API_ADDRESS"] + "/api/sessions/", json=json_obj, stream=True)

        return resp.raw.read(), resp.status_code, resp.headers.items()


    @app.route("/catch/api-proxy/api/experiments/", methods=["POST"])
    def catch_api_proxy_experiments_post():

        json_obj = request.json

        json_obj["pipeline_run_spec"]["run_config"] = {
            "host_user_dir": app.config["HOST_USER_DIR"]
        }

        resp = requests.post(
            "http://" + app.config["ORCHEST_API_ADDRESS"] + "/api/experiments/", json=json_obj, stream=True)

        return resp.raw.read(), resp.status_code, resp.headers.items()


    @app.route("/catch/api-proxy/api/experiments/<experiment_uuid>", methods=["GET"])
    def catch_api_proxy_experiments_get(experiment_uuid):

        json_obj = request.json

        resp = requests.get(
            "http://" + app.config["ORCHEST_API_ADDRESS"] + "/api/experiments/" + experiment_uuid, json=json_obj, stream=True)

        # get PipelineRuns to augment response
        pipeline_runs = PipelineRun.query.filter(
            PipelineRun.experiment == experiment_uuid).all()

        pipeline_runs_dict = {}

        for pipeline_run in pipeline_runs:
            pipeline_runs_dict[pipeline_run.id] = pipeline_run

        json_return = resp.json()
        json_return["pipeline_runs"] = sorted(json_return['pipeline_runs'], key= lambda x: x["pipeline_run_id"])

        # augment response with parameter values that are stored on the webserver
        if resp.status_code == 200:

            try:
                logging.info(json_return)

                for run in json_return["pipeline_runs"]:
                    run["parameters"] = pipeline_runs_dict[run["pipeline_run_id"]].parameter_json

                return jsonify(json_return)
            except Exception as e:
                return str(e), 500

        else:
            return resp.raw.read(), resp.status_code


    @app.route("/async/spawn-update-server", methods=["GET"])
    def spawn_update_server():

        client = docker.from_env()
        
        orchest_ctl(client, ["_updateserver"])

        return ''

    
    @app.route("/heartbeat", methods=["GET"])
    def heartbeat():
        return ''


    @app.route("/async/restart", methods=["POST"])
    def restart_server():

        client = docker.from_env()
        
        if request.args.get("mode") == "dev":
            orchest_ctl(client, ["restart", "dev"])
        else:
            orchest_ctl(client, ["restart"])

        return ''

    
    @app.route("/async/version", methods=["GET"])
    def version():

        git_proc = subprocess.Popen(
            "echo \"git commit: $(git rev-parse --short HEAD) [$(git rev-parse HEAD)] on branch '$(git rev-parse --abbrev-ref HEAD)'\"", 
            cwd="/orchest-host", 
            shell=True, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.STDOUT,
            text=True
        )

        outs, _ = git_proc.communicate()

        return outs


    @app.route("/async/user-config", methods=["GET", "POST"])
    def user_config():

        if request.method == "POST":
            
            config = request.form.get("config")

            try:
                # only save if parseable JSON
                json.loads(config)
                save_user_conf_raw(config)

            except json.JSONDecodeError as e:
                logging.debug(e)

            return ''
        else:
            return get_user_conf_raw()


    @app.route("/async/synthesized-images", methods=["GET"])
    def images_get():

        synthesized_images, _ = get_synthesized_images(language=request.args.get("language"))

        result = {
            "success": True,
            "images": synthesized_images
        }

        return jsonify(result), 200, {"content-type": "application/json"}


    @app.route("/async/pipelines/delete/<pipeline_uuid>", methods=["POST"])
    def pipelines_delete(pipeline_uuid):

        # also delete directory
        pipeline_dir = get_pipeline_directory_by_uuid(pipeline_uuid)

        # TODO: find way to not force sudo remove on pipeline dirs
        # protection: should always be at least length of pipeline UUID, should be careful because of rm -rf command
        if len(pipeline_dir) > 36:
            os.system("rm -rf %s" % pipeline_dir)

        return jsonify({"success": True})


    @app.route("/async/experiments/create", methods=["POST"])
    def experiments_create():

        experiment_uuid = str(uuid.uuid4())

        if Experiment.query.filter(Experiment.uuid == experiment_uuid).count() > 0:
            raise ExperimentUuidInUse()

        new_ex = Experiment(
            uuid=experiment_uuid,
            name=request.json["name"],
            pipeline_uuid=request.json["pipeline_uuid"],
            pipeline_name=request.json["pipeline_name"],
            strategy_json="",
            draft=True,
        )

        db.session.add(new_ex)
        db.session.commit()

        create_experiment_directory(
            experiment_uuid, request.json["pipeline_uuid"])

        return experiment_schema.dump(new_ex)


    @app.route("/async/pipelineruns/create", methods=["POST"])
    def pipelineruns_create():

        experiment_uuid = request.json["experiment_uuid"]
        # remove all existing associated pipeline runs
        PipelineRun.query.filter(
            PipelineRun.experiment == experiment_uuid).delete()

        for idx, pipeline_run in enumerate(request.json["generated_pipeline_runs"]):

            pr = PipelineRun(
                uuid=request.json["experiment_json"]["pipeline_runs"][idx]["run_uuid"],
                experiment=experiment_uuid,
                parameter_json=pipeline_run,
                id=request.json["pipeline_run_ids"][idx]
            )

            db.session.add(pr)

        db.session.commit()

        return jsonify({"success": True})


    @app.route("/async/pipelines/create", methods=["POST"])
    def pipelines_create():

        pipeline_uuid = str(uuid.uuid4())

        # create dirs
        pipeline_dir = get_pipeline_directory_by_uuid(pipeline_uuid)

        os.makedirs(os.path.join(pipeline_dir, ".orchest"), exist_ok=True)

        # generate clean pipeline.json
        pipeline_json = {
            "name": request.form.get("name"),
            "uuid": pipeline_uuid,
            "version": "1.0.0"
        }

        with open(os.path.join(pipeline_dir, _config.PIPELINE_DESCRIPTION_PATH), "w") as pipeline_json_file:
            pipeline_json_file.write(json.dumps(pipeline_json))

        return jsonify({"success": True})


    @app.route("/async/pipelines/rename/<string:pipeline_uuid>", methods=["POST"])
    def pipelines_rename(pipeline_uuid):

        pipeline_dir = get_pipeline_directory_by_uuid(pipeline_uuid)

        if os.path.isdir(pipeline_dir) and os.path.isfile(os.path.join(pipeline_dir, _config.PIPELINE_DESCRIPTION_PATH)):

            # rename pipeline in JSON file
            pipeline_json_path = os.path.join(pipeline_dir, _config.PIPELINE_DESCRIPTION_PATH)

            with open(pipeline_json_path, "r") as json_file:
                pipeline_json = json.load(json_file)

            pipeline_json["name"] = request.form.get("name")

            with open(pipeline_json_path, "w") as json_file:
                json_file.write(json.dumps(pipeline_json))

            json_string = json.dumps({"success": True})
            return json_string, 200, {"content-type": "application/json"}
        else:
            return "", 404


    @app.route("/async/pipelines/get/<string:pipeline_uuid>", methods=["GET"])
    def pipelines_get_single(pipeline_uuid):

        pipeline_dir = None

        if "pipeline_run_uuid" in request.args:
            pipeline_dir = get_pipeline_directory_by_uuid(
                pipeline_uuid, pipeline_run_uuid=request.args.get("pipeline_run_uuid"))
        else:
            pipeline_dir = get_pipeline_directory_by_uuid(pipeline_uuid)

        pipeline_json_path = os.path.join(pipeline_dir, _config.PIPELINE_DESCRIPTION_PATH)

        if os.path.isfile(pipeline_json_path):

            with open(pipeline_json_path, "r") as json_file:
                pipeline_json = json.load(json_file)

                pipeline_light = {
                    "name": pipeline_json["name"],
                    "uuid": pipeline_json["uuid"]
                }
                json_string = json.dumps(
                    {"success": True, "result": pipeline_light})
                return json_string, 200, {"content-type": "application/json"}
        else:
            return "", 404


    @app.route("/async/pipelines/get_directory/<string:pipeline_uuid>", methods=["GET"])
    def pipelines_get_directory(pipeline_uuid):
        json_string = json.dumps({"success": True, "result": get_pipeline_directory_by_uuid(
            pipeline_uuid, host_path=True)})
        return json_string, 200, {"content-type": "application/json"}


    @app.route("/async/pipelines", methods=["GET"])
    def pipelines_get():

        pipelines_dir = get_pipelines_dir()

        pipeline_uuids = [f.path for f in os.scandir(
            pipelines_dir) if f.is_dir()]

        pipelines = []

        for pipeline_uuid in pipeline_uuids:

            pipeline_json_path = os.path.join(
                pipelines_dir, pipeline_uuid, _config.PIPELINE_DESCRIPTION_PATH)

            if os.path.isfile(pipeline_json_path):
                with open(pipeline_json_path, "r") as json_file:
                    pipeline_json = json.load(json_file)

                    pipelines.append({
                        "name": pipeline_json["name"],
                        "uuid": pipeline_json["uuid"],
                    })

        json_string = json.dumps(
            {"success": True, "result": pipelines})
        return json_string, 200, {"content-type": "application/json"}


    @app.route("/async/notebook_html/<string:pipeline_uuid>/<string:step_uuid>", methods=["GET"])
    def notebook_html_get(pipeline_uuid, step_uuid):

        pipeline_dir = None

        if "pipeline_run_uuid" in request.args:
            pipeline_dir = get_pipeline_directory_by_uuid(
                pipeline_uuid, pipeline_run_uuid=request.args.get("pipeline_run_uuid"))
        else:
            pipeline_dir = get_pipeline_directory_by_uuid(pipeline_uuid)

        pipeline_json_path = os.path.join(pipeline_dir, _config.PIPELINE_DESCRIPTION_PATH)

        if os.path.isfile(pipeline_json_path):
            with open(pipeline_json_path, "r") as json_file:
                pipeline_json = json.load(json_file)

            try:
                notebook_path = os.path.join(
                    pipeline_dir, pipeline_json["steps"][step_uuid]["file_path"])
            except Exception as e:
                logging.info(e)
                return return_404("Invalid JSON for pipeline %s error: %e" % (pipeline_uuid, e))
        else:
            return return_404("Could not find pipeline.json for pipeline %s" % pipeline_uuid)

        if os.path.isfile(notebook_path):
            try:

                html_exporter = HTMLExporter()
                (body, _) = html_exporter.from_filename(notebook_path)

                return body

            except IOError as error:
                logging.info("Error opening notebook file %s error: %s" % (
                    notebook_path, error))
                return return_404("Could not find notebook file %s" % notebook_path)


    @app.route("/async/commits/shell/<string:commit_uuid>", methods=["GET", "POST"])
    def commit_shell(commit_uuid):

        commit = Commit.query.filter(Commit.uuid == commit_uuid).first()
        if commit is None:
            json_string = json.dumps(
                {"success": False, "reason": "Commit does not exist for UUID %s" % (commit_uuid)})

            return json_string, 404, {"content-type": "application/json"}


        shell_file_dir = os.path.join(app.config["USER_DIR"], ".orchest", "commits", commit_uuid)
        shell_file_path = os.path.join(shell_file_dir, "shell.sh")

        if request.method == "POST":

            try:
                if not os.path.isdir(shell_file_dir):
                    os.makedirs(shell_file_dir)

                with open(shell_file_path, "w") as file:
                    file.write(request.json['shell'])

                json_string = json.dumps({"success": True})

                return json_string, 200, {"content-type": "application/json"}

            except:
                json_string = json.dumps(
                    {"success": False, "reason": "Could not create shell file"})

                return json_string, 500, {"content-type": "application/json"}

        else:

            if os.path.isfile(shell_file_path):

                with open(shell_file_path, "r") as file:
                    shell = file.read()

                    json_string = json.dumps(
                        {"success": True, "shell": shell})

                    return json_string, 200, {"content-type": "application/json"}

            else:
                json_string = json.dumps(
                    {"success": False, "reason": "Could not find shell file"})

                return json_string, 404, {"content-type": "application/json"}


    @app.route("/async/logs/<string:pipeline_uuid>/<string:step_uuid>", methods=["GET"])
    def logs_get(pipeline_uuid, step_uuid):

        pipeline_dir = None

        if "pipeline_run_uuid" in request.args:
            pipeline_dir = get_pipeline_directory_by_uuid(
                pipeline_uuid, pipeline_run_uuid=request.args.get("pipeline_run_uuid"))
        else:
            pipeline_dir = get_pipeline_directory_by_uuid(pipeline_uuid)


        log_path = os.path.join(
            pipeline_dir, app.config["LOG_DIR"], "%s.log" % step_uuid)

        logs = None

        if os.path.isfile(log_path):
            try:

                with open(log_path, "r") as f:
                    logs = f.read()

            except IOError as error:
                logging.info("Error opening log file %s error: %s" %
                              (log_path, error))

        if logs is not None:
            json_string = json.dumps(
                {"success": True, "result": logs})

            return json_string, 200, {"content-type": "application/json"}

        else:
            json_string = json.dumps(
                {"success": False, "reason": "Could not find log file"})

            return json_string, 404, {"content-type": "application/json"}


    @app.route("/async/pipelines/json/save", methods=["POST"])
    def pipelines_json_save():

        pipeline_directory = get_pipeline_directory_by_uuid(
            request.form.get("pipeline_uuid"))

        # parse JSON
        pipeline_json = json.loads(request.form.get("pipeline_json"))

        # first create all files part of pipeline_json definition
        # TODO: consider removing other files (no way to do this reliably,
        # special case might be rename)
        create_pipeline_files(pipeline_json)

        # side effect: for each Notebook in de pipeline.json set the correct kernel
        pipeline_set_notebook_kernels(pipeline_json)

        with open(os.path.join(pipeline_directory, _config.PIPELINE_DESCRIPTION_PATH), "w") as json_file:
            json_file.write(json.dumps(pipeline_json))

        return jsonify({"success": True})


    @app.route("/async/pipelines/json/experiments/<pipeline_uuid>", methods=["GET"])
    def pipelines_json_experiments_get(pipeline_uuid):

        pipeline_directory = get_pipeline_directory_by_uuid(pipeline_uuid)

        pipeline_json_path = os.path.join(pipeline_directory, _config.PIPELINE_DESCRIPTION_PATH)
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

        pipeline_dir = None

        if "pipeline_run_uuid" in request.args:
            pipeline_dir = get_pipeline_directory_by_uuid(
                pipeline_uuid, pipeline_run_uuid=request.args.get("pipeline_run_uuid"))
        else:
            pipeline_dir = get_pipeline_directory_by_uuid(pipeline_uuid)

        pipeline_json_path = os.path.join(pipeline_dir, _config.PIPELINE_DESCRIPTION_PATH)
        if not os.path.isfile(pipeline_json_path):
            return jsonify({"success": False, "reason": "pipeline.json doesn't exist"}), 404
        else:
            with open(pipeline_json_path) as json_file:
                return jsonify({"success": True, "pipeline_json": json_file.read()})
