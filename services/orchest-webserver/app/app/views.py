import json
import os
import shutil
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
from app.utils import (
    get_hash,
    get_user_conf,
    get_user_conf_raw,
    save_user_conf_raw,
    name_to_tag,
    find_pipelines_in_dir,
    pipeline_uuid_to_path,
    project_uuid_to_path,
    remove_dir_if_empty,
    get_pipeline_path,
    get_pipeline_directory,
    get_project_directory,
    get_environment_directory,
    get_environments,
    serialize_environment_to_disk,
    read_environment_from_disk
)
from app.models import (
    DataSource,
    Experiment,
    Environment,
    PipelineRun,
    Project,
    Pipeline,
)

from app.schemas import (
    ProjectSchema,
    PipelineSchema,
    DataSourceSchema,
    EnvironmentSchema,
    ExperimentSchema
)
from app.kernel_manager import populate_kernels
from _orchest.internals.utils import run_orchest_ctl
from _orchest.internals import config as _config


logging.basicConfig(level=logging.DEBUG)


def register_views(app, db):

    class DataSourceNameInUse(HTTPException):
        pass

    project_schema = ProjectSchema()
    projects_schema = ProjectSchema(many=True)

    pipeline_schema = PipelineSchema()
    pipelines_schema = PipelineSchema(many=True)

    datasource_schema = DataSourceSchema()
    datasources_schema = DataSourceSchema(many=True)

    environment_schema = EnvironmentSchema()
    environments_schema = EnvironmentSchema(many=True)

    experiment_schema = ExperimentSchema()
    experiments_schema = ExperimentSchema(many=True)

    def return_404(reason=""):
        json_string = json.dumps({"success": False, "reason": reason})

        return json_string, 404, {"content-type": "application/json"}

    def generate_gateway_kernel_name(project_uuid, environment_uuid):
        
        return _config.ENVIRONMENT_IMAGE_NAME.format(
            project_uuid=project_uuid,
            environment_uuid=environment_uuid
        )

    def pipeline_set_notebook_kernels(pipeline_json, pipeline_directory, project_uuid):

        # for each step set correct notebook kernel if it exists

        steps = pipeline_json["steps"].keys()

        for key in steps:
            step = pipeline_json["steps"][key]

            if "ipynb" == step["file_path"].split(".")[-1]:

                notebook_path = os.path.join(pipeline_directory, step["file_path"])

                if os.path.isfile(notebook_path):

                    gateway_kernel = generate_gateway_kernel_name(
                        project_uuid, step["environment"]
                    )

                    with open(notebook_path, "r") as file:
                        notebook_json = json.load(file)

                    notebook_changed = False

                    if (
                        notebook_json["metadata"]["kernelspec"]["name"]
                        != gateway_kernel
                    ):
                        notebook_changed = True
                        notebook_json["metadata"]["kernelspec"]["name"] = gateway_kernel
                    
                    environment = Environment.query.filter(
                        Environment.uuid==step['environment']
                    ).filter(
                        Environment.project_uuid==project_uuid
                    ).first()

                    if environment is not None:
                        if (
                            notebook_json["metadata"]["kernelspec"]["display_name"]
                            != environment.name
                        ):
                            notebook_changed = True
                            notebook_json["metadata"]["kernelspec"]["display_name"] = environment.name
                    else:
                        logging.warn("Could not find environment [%s] while setting notebook kernelspec for notebook %s." % (
                            step['environment'], notebook_path))

                    if notebook_changed:
                        with open(notebook_path, "w") as file:
                            file.write(json.dumps(notebook_json, indent=2))

                else:
                    logging.info(
                        "pipeline_set_notebook_kernels called on notebook_path that doesn't exist %s"
                        % notebook_path
                    )

    

    def generate_ipynb_from_template(step, project_uuid):

        # TODO: support additional languages to Python and R
        if "python" in step["kernel"]["name"].lower():
            template_json = json.load(
                open(
                    os.path.join(app.config["RESOURCE_DIR"], "ipynb_template.json"), "r"
                )
            )
        else:
            template_json = json.load(
                open(
                    os.path.join(app.config["RESOURCE_DIR"], "ipynb_template_r.json"),
                    "r",
                )
            )

        template_json["metadata"]["kernelspec"]["display_name"] = step["kernel"][
            "display_name"
        ]
        template_json["metadata"]["kernelspec"]["name"] = generate_gateway_kernel_name(
            project_uuid,
            step["environment"]
        )

        return json.dumps(template_json, indent=2)

    def create_pipeline_files(pipeline_json, pipeline_directory, project_uuid):

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
            file_name_split = file_name.split(".")
            file_name_without_ext = ".".join(file_name_split[:-1])
            ext = file_name_split[-1]

            file_content = None

            if not os.path.isfile(full_file_path):

                if len(file_name_without_ext) > 0:
                    file_content = ""

                if ext == "ipynb":
                    file_content = generate_ipynb_from_template(step, project_uuid)
                    
            elif ext == "ipynb":
                # check for empty .ipynb, for which we also generate a template notebook
                if os.stat(full_file_path).st_size:
                    file_content = generate_ipynb_from_template(step, project_uuid)

            if file_content is not None:
                with open(full_file_path, "w") as file:
                    file.write(file_content)
                        

    def create_experiment_directory(experiment_uuid, pipeline_uuid, project_uuid):

        experiment_path = os.path.join(
            app.config["USER_DIR"],
            "experiments",
            project_uuid,
            pipeline_uuid,
            experiment_uuid,
        )

        os.makedirs(experiment_path)
        snapshot_path = os.path.join(experiment_path, "snapshot")
        project_dir = os.path.join(
            app.config["USER_DIR"], "projects", project_uuid_to_path(project_uuid)
        )
        os.system("cp -R %s %s" % (project_dir, snapshot_path))

    def remove_experiment_directory(experiment_uuid, pipeline_uuid, project_uuid):

        experiment_project_path = os.path.join(
            app.config["USER_DIR"], "experiments", project_uuid
        )

        experiment_pipeline_path = os.path.join(experiment_project_path, pipeline_uuid)

        experiment_path = os.path.join(experiment_pipeline_path, experiment_uuid)

        if os.path.isdir(experiment_path):
            os.system("rm -r %s" % (experiment_path))

        # clean up parent directory if this experiment removal created empty directories
        remove_dir_if_empty(experiment_pipeline_path)
        remove_dir_if_empty(experiment_project_path)

    def remove_commit_image(commit):
        full_image_name = "%s:%s" % (commit.base_image, commit.tag)
        try:
            client = docker.from_env()
            client.images.remove(full_image_name, noprune=True)
        except:
            logging.info("Unable to remove image: %s" % full_image_name)

    def remove_commit_shell(commit):

        shell_file_dir = os.path.join(
            app.config["USER_DIR"], ".orchest", "commits", commit.uuid
        )

        if os.path.isdir(shell_file_dir):
            os.system("rm -r %s" % (shell_file_dir))

    def register_environments(db, api):

        class EnvironmentsResource(Resource):
            def get(self, project_uuid):
                return environments_schema.dump(get_environments(project_uuid, language=request.args.get('language')))

        class EnvironmentResource(Resource):

            def put(self, project_uuid, environment_uuid):
                return self.post(project_uuid, environment_uuid)

            def get(self, project_uuid, environment_uuid):
                environment_dir = get_environment_directory(environment_uuid, project_uuid)
                return read_environment_from_disk(environment_dir)

            def delete(self, project_uuid, environment_uuid):
                environment_dir = get_environment_directory(environment_uuid, project_uuid)
                shutil.rmtree(environment_dir)

                # refresh kernels after change in environments
                populate_kernels(app, db)

                return jsonify({"message": "Environment deletion was successful."})

            def post(self, project_uuid, environment_uuid):

                # create a new environment in the project
                environment_json = request.json.get("environment")

                e = Environment(
                    uuid=str(uuid.uuid4()),
                    name=environment_json['name'],
                    project_uuid=project_uuid,
                    language=environment_json["language"],
                    startup_script=environment_json["startup_script"],
                    base_image=environment_json["base_image"],
                    gpu_support=environment_json["gpu_support"],
                    building=environment_json["building"],
                )

                # use specified uuid if it's not keyword 'new'
                if environment_uuid != "new":
                    e.uuid = environment_uuid

                environment_dir = get_environment_directory(e.uuid, project_uuid)
                
                os.makedirs(environment_dir, exist_ok=True)
                serialize_environment_to_disk(e, environment_dir)

                # refresh kernels after change in environments
                populate_kernels(app, db)

                return environment_schema.dump(e)

        api.add_resource(EnvironmentsResource, "/store/environments/<string:project_uuid>")
        api.add_resource(EnvironmentResource, "/store/environments/<string:project_uuid>/<string:environment_uuid>")


    def register_datasources(db, api):
        class DataSourcesResource(Resource):
            def get(self):

                show_internal = True
                if request.args.get("show_internal") == "false":
                    show_internal = False

                if show_internal:
                    datasources = DataSource.query.all()
                else:
                    datasources = DataSource.query.filter(
                        ~DataSource.name.like("\_%", escape="\\")
                    ).all()

                return datasources_schema.dump(datasources)

        class DataSourceResource(Resource):
            def put(self, name):
                ds = DataSource.query.filter(DataSource.name == name).first()

                if ds is None:
                    return "", 404

                ds.name = request.json["name"]
                ds.source_type = request.json["source_type"]
                ds.connection_details = request.json["connection_details"]
                db.session.commit()

                return datasource_schema.dump(ds)

            def get(self, name):
                ds = DataSource.query.filter(DataSource.name == name).first()

                if ds is None:
                    return "", 404

                return datasource_schema.dump(ds)

            def delete(self, name):
                ds = DataSource.query.filter(DataSource.name == name).first()

                if ds is None:
                    return "", 404

                db.session.delete(ds)
                db.session.commit()

                return jsonify({"message": "Data source deletion was successful"})

            def post(self, name):
                if DataSource.query.filter(DataSource.name == name).count() > 0:
                    raise DataSourceNameInUse()

                new_ds = DataSource(
                    name=name,
                    source_type=request.json["source_type"],
                    connection_details=request.json["connection_details"],
                )

                db.session.add(new_ds)
                db.session.commit()

                return datasource_schema.dump(new_ds)

        api.add_resource(DataSourcesResource, "/store/datasources")
        api.add_resource(DataSourceResource, "/store/datasources/<string:name>")

    def register_experiments(db, api):
        class ExperimentsResource(Resource):
            def get(self):
                experiments = Experiment.query.all()
                return experiments_schema.dump(experiments)

        class ExperimentResource(Resource):
            def put(self, experiment_uuid):

                ex = Experiment.query.filter(Experiment.uuid == experiment_uuid).first()

                if ex is None:
                    return "", 404

                ex.name = request.json["name"]
                ex.pipeline_uuid = request.json["pipeline_uuid"]
                ex.pipeline_name = request.json["pipeline_name"]
                ex.strategy_json = request.json["strategy_json"]
                ex.draft = request.json["draft"]

                db.session.commit()

                return experiment_schema.dump(ex)

            def get(self, experiment_uuid):
                ex = Experiment.query.filter(Experiment.uuid == experiment_uuid).first()

                if ex is None:
                    return "", 404

                return experiment_schema.dump(ex)

            def delete(self, experiment_uuid):

                # remove experiment directory
                ex = Experiment.query.filter(Experiment.uuid == experiment_uuid).first()

                if ex is None:
                    return "", 404

                remove_experiment_directory(ex.uuid, ex.pipeline_uuid, ex.project_uuid)

                db.session.delete(ex)
                db.session.commit()

                return jsonify({"message": "Experiment termination was successful"})

            def post(self, experiment_uuid):

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
        api.add_resource(
            ExperimentResource, "/store/experiments/<string:experiment_uuid>"
        )

    def register_rest(app, db):

        errors = {
            "DataSourceNameInUse": {
                "message": "A data source with this name already exists.",
                "status": 409,
            },
        }

        api = Api(app, errors=errors)

        register_datasources(db, api)
        register_experiments(db, api)
        register_environments(db, api)

    register_rest(app, db)

    @app.route("/", methods=["GET"])
    def index():

        js_bundle_path = os.path.join(
            app.config["STATIC_DIR"], "js", "dist", "main.bundle.js"
        )
        css_bundle_path = os.path.join(app.config["STATIC_DIR"], "css", "main.css")

        return render_template(
            "index.html",
            javascript_bundle_hash=get_hash(js_bundle_path),
            css_bundle_hash=get_hash(css_bundle_path),
            user_config=get_user_conf(),
            DOCS_ROOT=app.config["DOCS_ROOT"],
            FLASK_ENV=app.config["FLASK_ENV"],
        )


    @app.route("/catch/api-proxy/api/environment_builds/<project_uuid>/<environment_uuid>", methods=["POST"])
    def catch_api_proxy_builds(project_uuid, environment_uuid):
        # TODO: integrate with backend for environment build jobs
        return "Stub: trigger build for %s, %s" % (project_uuid, environment_uuid)


    @app.route("/catch/api-proxy/api/runs/", methods=["POST"])
    def catch_api_proxy_runs():

        json_obj = request.json

        # add image mapping
        # TODO: replace with dynamic mapping instead of hardcoded
        json_obj["run_config"] = {
            "project_dir": get_project_directory(
                json_obj["project_uuid"], host_path=True
            ),
            "pipeline_path": pipeline_uuid_to_path(
                json_obj["pipeline_description"]["uuid"], json_obj["project_uuid"]
            ),
        }

        resp = requests.post(
            "http://" + app.config["ORCHEST_API_ADDRESS"] + "/api/runs/",
            json=json_obj,
            stream=True,
        )

        return resp.raw.read(), resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/sessions/", methods=["POST"])
    def catch_api_proxy_sessions():

        json_obj = request.json

        json_obj["project_dir"] = get_project_directory(
            json_obj["project_uuid"], host_path=True
        )

        json_obj["pipeline_path"] = pipeline_uuid_to_path(
            json_obj["pipeline_uuid"], json_obj["project_uuid"],
        )

        json_obj["host_userdir"] = app.config["HOST_USER_DIR"]

        resp = requests.post(
            "http://" + app.config["ORCHEST_API_ADDRESS"] + "/api/sessions/",
            json=json_obj,
            stream=True,
        )

        return resp.raw.read(), resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/experiments/", methods=["POST"])
    def catch_api_proxy_experiments_post():

        json_obj = request.json

        json_obj["pipeline_run_spec"]["run_config"] = {
            "host_user_dir": app.config["HOST_USER_DIR"],
            "project_dir": get_project_directory(
                json_obj["project_uuid"], host_path=True
            ),
            "pipeline_path": pipeline_uuid_to_path(
                json_obj["pipeline_uuid"], json_obj["project_uuid"],
            ),
        }

        resp = requests.post(
            "http://" + app.config["ORCHEST_API_ADDRESS"] + "/api/experiments/",
            json=json_obj,
            stream=True,
        )

        return resp.raw.read(), resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/experiments/<experiment_uuid>", methods=["GET"])
    def catch_api_proxy_experiments_get(experiment_uuid):

        resp = requests.get(
            "http://"
            + app.config["ORCHEST_API_ADDRESS"]
            + "/api/experiments/"
            + experiment_uuid,
            stream=True,
        )

        # get PipelineRuns to augment response
        pipeline_runs = PipelineRun.query.filter(
            PipelineRun.experiment == experiment_uuid
        ).all()

        pipeline_runs_dict = {}

        for pipeline_run in pipeline_runs:
            pipeline_runs_dict[pipeline_run.id] = pipeline_run

        json_return = resp.json()
        json_return["pipeline_runs"] = sorted(
            json_return["pipeline_runs"], key=lambda x: x["pipeline_run_id"]
        )

        # augment response with parameter values that are stored on the webserver
        if resp.status_code == 200:

            try:
                logging.info(json_return)

                for run in json_return["pipeline_runs"]:
                    run["parameters"] = pipeline_runs_dict[
                        run["pipeline_run_id"]
                    ].parameter_json

                return jsonify(json_return)
            except Exception as e:
                return str(e), 500

        else:
            return resp.raw.read(), resp.status_code

    @app.route("/async/spawn-update-server", methods=["GET"])
    def spawn_update_server():

        client = docker.from_env()

        run_orchest_ctl(client, ["updateserver"])

        return ""

    @app.route("/heartbeat", methods=["GET"])
    def heartbeat():
        return ""

    @app.route("/async/restart", methods=["POST"])
    def restart_server():

        client = docker.from_env()

        if request.args.get("mode") == "dev":
            run_orchest_ctl(client, ["restart", "--mode=dev"])
        else:
            run_orchest_ctl(client, ["restart"])

        return ""

    @app.route("/async/version", methods=["GET"])
    def version():

        git_proc = subprocess.Popen(
            "echo \"git commit: $(git rev-parse --short HEAD) [$(git rev-parse HEAD)] on branch '$(git rev-parse --abbrev-ref HEAD)'\"",
            cwd="/orchest-host",
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
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

            return ""
        else:
            return get_user_conf_raw()


    @app.route(
        "/async/pipelines/delete/<project_uuid>/<pipeline_uuid>", methods=["DELETE"]
    )
    def pipelines_delete(project_uuid, pipeline_uuid):

        if (
            Pipeline.query.filter(Pipeline.uuid == pipeline_uuid)
            .filter(Pipeline.project_uuid == project_uuid)
            .count()
            > 0
        ):

            pipeline_json_path = get_pipeline_path(pipeline_uuid, project_uuid)

            # TODO: find way to not force sudo remove on pipeline dirs
            # protection: should always be at least length of pipeline UUID, should be careful because of rm -rf command
            os.system("rm -rf %s" % pipeline_json_path)

            pipeline = (
                Pipeline.query.filter(Pipeline.uuid == pipeline_uuid)
                .filter(Pipeline.project_uuid == project_uuid)
                .first()
            )
            db.session.delete(pipeline)
            db.session.commit()

            return jsonify({"success": True})
        else:
            return jsonify({"message": "Pipeline could not be found."}), 404

    @app.route("/async/experiments/create", methods=["POST"])
    def experiments_create():

        experiment_uuid = str(uuid.uuid4())

        new_ex = Experiment(
            uuid=experiment_uuid,
            name=request.json["name"],
            pipeline_uuid=request.json["pipeline_uuid"],
            project_uuid=request.json["project_uuid"],
            pipeline_name=request.json["pipeline_name"],
            strategy_json="",
            draft=True,
        )

        db.session.add(new_ex)
        db.session.commit()

        create_experiment_directory(
            experiment_uuid, request.json["pipeline_uuid"], request.json["project_uuid"]
        )

        return jsonify(experiment_schema.dump(new_ex))

    @app.route("/async/pipelineruns/create", methods=["POST"])
    def pipelineruns_create():

        experiment_uuid = request.json["experiment_uuid"]

        for idx, pipeline_run in enumerate(request.json["generated_pipeline_runs"]):

            pr = PipelineRun(
                uuid=request.json["experiment_json"]["pipeline_runs"][idx]["run_uuid"],
                experiment=experiment_uuid,
                parameter_json=pipeline_run,
                id=request.json["pipeline_run_ids"][idx],
            )

            db.session.add(pr)

        db.session.commit()

        return jsonify({"success": True})

    @app.route("/async/pipelines/create/<project_uuid>", methods=["POST"])
    def pipelines_create(project_uuid):

        pipeline_path = request.json["pipeline_path"]

        if (
            Pipeline.query.filter(Pipeline.project_uuid == project_uuid)
            .filter(Pipeline.path == pipeline_path)
            .count()
            == 0
        ):

            pipeline_uuid = str(uuid.uuid4())

            pipeline = Pipeline(
                path=pipeline_path, uuid=pipeline_uuid, project_uuid=project_uuid
            )
            db.session.add(pipeline)
            db.session.commit()

            pipeline_dir = get_pipeline_directory(pipeline_uuid, project_uuid)
            pipeline_json_path = get_pipeline_path(pipeline_uuid, project_uuid)

            os.makedirs(pipeline_dir, exist_ok=True)

            # generate clean pipeline.json
            pipeline_json = {
                "name": request.json["name"],
                "version": "1.0.0",
                "uuid": pipeline_uuid,
                "steps": {},
            }

            with open(pipeline_json_path, "w") as pipeline_json_file:
                pipeline_json_file.write(json.dumps(pipeline_json, indent=2))

            return jsonify({"success": True})
        else:
            return (
                jsonify(
                    {"message": "Pipeline already exists at path '%s'." % pipeline_path}
                ),
                409,
            )

    # Note: only pipelines in project directories can be renamed (not in experiments)
    @app.route(
        "/async/pipelines/rename/<project_uuid>/<pipeline_uuid>", methods=["POST"]
    )
    def pipelines_rename(project_uuid, pipeline_uuid):

        if Pipeline.query.filter(Pipeline.uuid == pipeline_uuid).count() > 0:

            pipeline_json_path = get_pipeline_path(pipeline_uuid, project_uuid)

            if os.path.isfile(pipeline_json_path):

                with open(pipeline_json_path, "r") as json_file:
                    pipeline_json = json.load(json_file)

                pipeline_json["name"] = request.form.get("name")

                with open(pipeline_json_path, "w") as json_file:
                    json_file.write(json.dumps(pipeline_json, indent=2))

                json_string = json.dumps({"success": True})
                return json_string, 200, {"content-type": "application/json"}
            else:
                return "", 404
        else:
            return "", 404


    def populate_default_environments(project_uuid):

        for env_spec in app.config["DEFAULT_ENVIRONMENTS"]:

            e = Environment(**env_spec)

            e.uuid = str(uuid.uuid4())
            e.project_uuid = project_uuid

            environment_dir = get_environment_directory(e.uuid, project_uuid)
            os.makedirs(environment_dir, exist_ok=True)

            serialize_environment_to_disk(e, environment_dir)


    @app.route("/async/projects", methods=["GET", "POST", "DELETE"])
    def projects():

        project_dir = os.path.join(app.config["USER_DIR"], "projects")
        project_paths = [
            name
            for name in os.listdir(project_dir)
            if os.path.isdir(os.path.join(project_dir, name))
        ]

        # create UUID entry for all projects that do not yet exist
        existing_project_paths = [
            project.path
            for project in Project.query.filter(Project.path.in_(project_paths)).all()
        ]

        new_project_paths = set(project_paths) - set(existing_project_paths)

        for new_project_path in new_project_paths:
            new_project = Project(uuid=str(uuid.uuid4()), path=new_project_path,)
            db.session.add(new_project)
            db.session.commit()
        # end of UUID creation

        if request.method == "GET":
            return jsonify(projects_schema.dump(Project.query.all()))

        elif request.method == "DELETE":

            project_uuid = request.json["project_uuid"]

            project = Project.query.filter(Project.uuid == project_uuid).first()

            if project != None:

                project_path = project_uuid_to_path(project_uuid)
                full_project_path = os.path.join(project_dir, project_path)
                os.system("rm -r %s" % (full_project_path))

                db.session.delete(project)
                db.session.commit()

                # refresh kernels after change in environments
                populate_kernels(app, db)

                return jsonify({"message": "Project deleted."})
            else:
                return (
                    jsonify(
                        {"message": "Project not found for UUID %s." % project_uuid}
                    ),
                    404,
                )

        elif request.method == "POST":
            project_path = request.json["name"]

            if project_path not in project_paths:
                full_project_path = os.path.join(project_dir, project_path)
                if not os.path.isdir(full_project_path):

                    new_project = Project(uuid=str(uuid.uuid4()), path=project_path,)
                    db.session.add(new_project)
                    db.session.commit()

                    os.makedirs(full_project_path)

                    # initialize with default environments
                    populate_default_environments(new_project.uuid)

                    # refresh kernels after change in environments
                    populate_kernels(app, db)

                else:
                    return jsonify({"message": "Project directory exists."}), 409
            else:
                return (
                    jsonify({"message": "Project with the same name already exists."}),
                    409,
                )

            return jsonify({"message": "Project created."})

    @app.route("/async/pipelines/<project_uuid>/<pipeline_uuid>", methods=["GET"])
    def pipeline_get(project_uuid, pipeline_uuid):

        pipeline = (
            Pipeline.query.filter(Pipeline.project_uuid == project_uuid)
            .filter(Pipeline.uuid == pipeline_uuid)
            .first()
        )

        if pipeline is None:
            return jsonify({"message": "Pipeline doesn't exist."}), 404
        else:
            return jsonify(pipeline_schema.dump(pipeline))

    @app.route("/async/pipelines/<project_uuid>", methods=["GET"])
    def pipelines_get(project_uuid):

        project_path = project_uuid_to_path(project_uuid)
        project_dir = os.path.join(app.config["USER_DIR"], "projects", project_path)

        if not os.path.isdir(project_dir):
            return jsonify({"message": "Project directory not found."}), 404

        # find all pipelines in project dir
        pipeline_paths = find_pipelines_in_dir(project_dir, project_dir)

        # identify all pipeline paths that are not yet a pipeline
        existing_pipeline_paths = [
            pipeline.path
            for pipeline in Pipeline.query.filter(Pipeline.path.in_(pipeline_paths))
            .filter(Pipeline.project_uuid == project_uuid)
            .all()
        ]

        # TODO: handle existing pipeline assignments
        new_pipeline_paths = set(pipeline_paths) - set(existing_pipeline_paths)

        for new_pipeline_path in new_pipeline_paths:

            # write pipeline uuid to file
            pipeline_json_path = get_pipeline_path(
                None, project_uuid, pipeline_path=new_pipeline_path
            )

            try:
                with open(pipeline_json_path, "r") as json_file:
                    pipeline_json = json.load(json_file)

                file_pipeline_uuid = pipeline_json.get("uuid")

                new_pipeline_uuid = file_pipeline_uuid

                # see if pipeline_uuid is taken
                if (
                    Pipeline.query.filter(Pipeline.uuid == file_pipeline_uuid)
                    .filter(Pipeline.project_uuid == project_uuid)
                    .count()
                    > 0
                    or len(file_pipeline_uuid) == 0
                ):
                    new_pipeline_uuid = str(uuid.uuid4())

                with open(pipeline_json_path, "w") as json_file:
                    pipeline_json["uuid"] = new_pipeline_uuid
                    json_file.write(json.dumps(pipeline_json, indent=2))

                # only commit if writing succeeds
                new_pipeline = Pipeline(
                    uuid=new_pipeline_uuid,
                    path=new_pipeline_path,
                    project_uuid=project_uuid,
                )
                db.session.add(new_pipeline)
                db.session.commit()

            except Exception as e:
                logging.info(e)

        pipelines = Pipeline.query.filter(Pipeline.project_uuid == project_uuid).all()
        pipelines_augmented = []

        for pipeline in pipelines:

            pipeline_json_path = get_pipeline_path(pipeline.uuid, pipeline.project_uuid)

            pipeline_augmented = {
                "uuid": pipeline.uuid,
                "path": pipeline.path,
            }
            if os.path.isfile(pipeline_json_path):
                with open(pipeline_json_path, "r") as json_file:
                    pipeline_json = json.load(json_file)
                    pipeline_augmented["name"] = pipeline_json["name"]
            else:
                pipeline_augmented["name"] = "Warning: pipeline file was not found."

            pipelines_augmented.append(pipeline_augmented)

        json_string = json.dumps({"success": True, "result": pipelines_augmented})

        return json_string, 200, {"content-type": "application/json"}

    @app.route(
        "/async/notebook_html/<project_uuid>/<pipeline_uuid>/<step_uuid>",
        methods=["GET"],
    )
    def notebook_html_get(project_uuid, pipeline_uuid, step_uuid):

        experiment_uuid = request.args.get("experiment_uuid")
        pipeline_run_uuid = request.args.get("pipeline_run_uuid")

        pipeline_json_path = get_pipeline_path(
            pipeline_uuid, project_uuid, experiment_uuid, pipeline_run_uuid
        )
        pipeline_dir = get_pipeline_directory(
            pipeline_uuid, project_uuid, experiment_uuid, pipeline_run_uuid
        )

        if os.path.isfile(pipeline_json_path):
            with open(pipeline_json_path, "r") as json_file:
                pipeline_json = json.load(json_file)

            try:
                notebook_path = os.path.join(
                    pipeline_dir, pipeline_json["steps"][step_uuid]["file_path"]
                )
            except Exception as e:
                logging.info(e)
                return return_404(
                    "Invalid JSON for pipeline %s error: %e" % (pipeline_json_path, e)
                )
        else:
            return return_404(
                "Could not find pipeline.json for pipeline %s" % pipeline_json_path
            )

        if os.path.isfile(notebook_path):
            try:

                html_exporter = HTMLExporter()
                (body, _) = html_exporter.from_filename(notebook_path)

                return body

            except IOError as error:
                logging.info(
                    "Error opening notebook file %s error: %s" % (notebook_path, error)
                )
                return return_404("Could not find notebook file %s" % notebook_path)


    @app.route(
        "/async/pipelines/json/<project_uuid>/<pipeline_uuid>", methods=["GET", "POST"]
    )
    def pipelines_json_get(project_uuid, pipeline_uuid):

        pipeline_json_path = get_pipeline_path(
            pipeline_uuid,
            project_uuid,
            request.args.get("experiment_uuid"),
            request.args.get("pipeline_run_uuid"),
        )

        if request.method == "POST":

            pipeline_directory = get_pipeline_directory(
                pipeline_uuid,
                project_uuid,
                request.args.get("experiment_uuid"),
                request.args.get("pipeline_run_uuid"),
            )

            # parse JSON
            pipeline_json = json.loads(request.form.get("pipeline_json"))

            # first create all files part of pipeline_json definition
            # TODO: consider removing other files (no way to do this reliably,
            # special case might be rename)
            create_pipeline_files(pipeline_json, pipeline_directory, project_uuid)

            # side effect: for each Notebook in de pipeline.json set the correct kernel
            pipeline_set_notebook_kernels(pipeline_json, pipeline_directory, project_uuid)

            with open(pipeline_json_path, "w") as json_file:
                json_file.write(json.dumps(pipeline_json, indent=2))

            return jsonify({"success": True})

        elif request.method == "GET":

            if not os.path.isfile(pipeline_json_path):
                return (
                    jsonify(
                        {
                            "success": False,
                            "reason": ".orchest file doesn't exist at location %s"
                            % pipeline_json_path,
                        }
                    ),
                    404,
                )
            else:
                with open(pipeline_json_path) as json_file:
                    return jsonify({"success": True, "pipeline_json": json_file.read()})

            return ""

    ## TODO: in progress
    # @app.route("/async/file-picker-tree/<project_uuid>", methods=["GET"])
    # def get_file_picker_tree(project_uuid):

    #     project_dir = get_project_directory(project_uuid)

    #     if not os.path.isdir(project_dir):
    #         return jsonify({"message": "Project dir %s not found." % project_dir}), 404

    #     tree = {
    #         "type": "directory",
    #         "root": True,
    #         "name": "/",
    #         "children": []
    #     }

    #     dir_nodes = {}

    #     for root, dirs, files in os.walk(project_dir):

    #         for dir_name in dirs:
    #             dir_path = os.path.join(root, dir_name)

    #             dir_node = {
    #                 "type": "directory",
    #                 "name": dir_name,
    #                 "children": [],
    #             }

    #             dir_nodes[dir_path]


    #     return jsonify(tree)