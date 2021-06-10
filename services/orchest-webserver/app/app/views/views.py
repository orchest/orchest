import json
import os
import uuid

import docker
import requests
import sqlalchemy
from flask import current_app, jsonify, request
from flask_restful import Api, Resource
from nbconvert import HTMLExporter

from _orchest.internals import config as _config
from _orchest.internals.two_phase_executor import TwoPhaseExecutor
from _orchest.internals.utils import run_orchest_ctl
from app.analytics import send_anonymized_pipeline_definition
from app.config import CONFIG_CLASS as StaticConfig
from app.core.pipelines import CreatePipeline, DeletePipeline
from app.core.projects import (
    CreateProject,
    DeleteProject,
    ImportGitProject,
    SyncProjectPipelinesDBState,
)
from app.kernel_manager import populate_kernels
from app.models import Environment, Pipeline, Project
from app.schemas import BackgroundTaskSchema, EnvironmentSchema, ProjectSchema
from app.utils import (
    check_pipeline_correctness,
    create_pipeline_file,
    delete_environment,
    get_environment,
    get_environment_directory,
    get_environments,
    get_job_counts,
    get_pipeline_directory,
    get_pipeline_json,
    get_pipeline_path,
    get_project_directory,
    get_project_snapshot_size,
    get_repo_tag,
    get_session_counts,
    get_user_conf,
    get_user_conf_raw,
    pipeline_set_notebook_kernels,
    project_entity_counts,
    project_exists,
    save_user_conf_raw,
    serialize_environment_to_disk,
)


def register_views(app, db):
    errors = {}

    api = Api(app, errors=errors)

    projects_schema = ProjectSchema(many=True)

    environment_schema = EnvironmentSchema()
    environments_schema = EnvironmentSchema(many=True)

    background_task_schema = BackgroundTaskSchema()

    def register_environments(db, api):
        class EnvironmentsResource(Resource):
            def get(self, project_uuid):

                if project_exists(project_uuid):
                    return {"message": "Project could not be found."}, 404

                return environments_schema.dump(
                    get_environments(
                        project_uuid, language=request.args.get("language")
                    )
                )

        class EnvironmentResource(Resource):
            def put(self, project_uuid, environment_uuid):
                return self.post(project_uuid, environment_uuid)

            def get(self, project_uuid, environment_uuid):
                return environment_schema.dump(
                    get_environment(environment_uuid, project_uuid)
                )

            def delete(self, project_uuid, environment_uuid):

                delete_environment(app, project_uuid, environment_uuid)
                # refresh kernels after change in environments
                populate_kernels(app, db, project_uuid)

                return jsonify({"message": "Environment deletion was successful."})

            def post(self, project_uuid, environment_uuid):

                # create a new environment in the project
                environment_json = request.json.get("environment")

                e = Environment(
                    uuid=str(uuid.uuid4()),
                    name=environment_json["name"],
                    project_uuid=project_uuid,
                    language=environment_json["language"],
                    setup_script=environment_json["setup_script"],
                    base_image=environment_json["base_image"],
                    gpu_support=environment_json["gpu_support"],
                )

                # use specified uuid if it's not keyword 'new'
                if environment_uuid != "new":
                    e.uuid = environment_uuid

                environment_dir = get_environment_directory(e.uuid, project_uuid)

                os.makedirs(environment_dir, exist_ok=True)
                serialize_environment_to_disk(e, environment_dir)

                # refresh kernels after change in environments
                populate_kernels(app, db, project_uuid)

                return environment_schema.dump(e)

        api.add_resource(
            EnvironmentsResource, "/store/environments/<string:project_uuid>"
        )
        api.add_resource(
            EnvironmentResource,
            "/store/environments/<string:project_uuid>/<string:environment_uuid>",
        )

    register_environments(db, api)

    def return_404(reason=""):
        json_string = json.dumps({"success": False, "reason": reason})

        return json_string, 404, {"content-type": "application/json"}

    @app.route("/async/server-config", methods=["GET"])
    def server_config():
        front_end_config = [
            "FLASK_ENV",
            "TELEMETRY_DISABLED",
            "ENVIRONMENT_DEFAULTS",
            "ORCHEST_WEB_URLS",
            "CLOUD",
            "GPU_REQUEST_URL",
            "GPU_ENABLED_INSTANCE",
            "CLOUD_UNMODIFIABLE_CONFIG_VALUES",
            "INTERCOM_APP_ID",
            "INTERCOM_DEFAULT_SIGNUP_DATE",
        ]

        front_end_config_internal = [
            "ORCHEST_SOCKETIO_ENV_BUILDING_NAMESPACE",
            "ORCHEST_SOCKETIO_JUPYTER_BUILDING_NAMESPACE",
            "PIPELINE_PARAMETERS_RESERVED_KEY",
        ]

        return jsonify(
            {
                "user_config": get_user_conf(),
                "config": {
                    **{key: app.config[key] for key in front_end_config},
                    **{key: getattr(_config, key) for key in front_end_config_internal},
                },
            }
        )

    @app.route("/async/spawn-update-server", methods=["GET"])
    def spawn_update_server():

        client = docker.from_env()

        cmd = ["updateserver"]

        # Note that it won't work as --port {port}.
        cmd.append(f"--port={StaticConfig.ORCHEST_PORT}")

        if StaticConfig.FLASK_ENV == "development":
            cmd.append("--dev")

        if StaticConfig.CLOUD:
            cmd.append("--cloud")

        run_orchest_ctl(client, cmd)

        return ""

    @app.route("/heartbeat", methods=["GET"])
    def heartbeat():
        return ""

    @app.route("/async/restart", methods=["POST"])
    def restart_server():

        client = docker.from_env()
        cmd = ["restart"]

        # Note that it won't work as --port {port}.
        cmd.append(f"--port={StaticConfig.ORCHEST_PORT}")

        if StaticConfig.FLASK_ENV == "development":
            cmd.append("--dev")

        if StaticConfig.CLOUD:
            cmd.append("--cloud")

        run_orchest_ctl(client, cmd)

        return ""

    @app.route("/async/version", methods=["GET"])
    def version():
        return get_repo_tag()

    @app.route("/async/user-config", methods=["GET", "POST"])
    def user_config():

        # Current user config, from disk.
        current_config = json.loads(get_user_conf_raw())

        if request.method == "POST":

            # Updated config, from client.
            config = request.form.get("config")

            try:
                # Only save if parseable JSON.
                config = json.loads(config)

                # Do not allow some settings to be modified or removed
                # while running with --cloud, by overwriting whatever
                # value was set (or unset) using the current
                # configuration.
                if StaticConfig.CLOUD:
                    for setting in StaticConfig.CLOUD_UNMODIFIABLE_CONFIG_VALUES:
                        if setting in current_config:
                            config[setting] = current_config[setting]
                        else:
                            config.pop(setting, None)

                # Save the updated configuration.
                save_user_conf_raw(json.dumps(config))
                current_config = config

            except json.JSONDecodeError as e:
                app.logger.debug(e)

        return current_config

    @app.route("/async/jupyter-setup-script", methods=["GET", "POST"])
    def jupyter_setup_script():

        setup_script_path = os.path.join(
            app.config["USER_DIR"], _config.JUPYTER_SETUP_SCRIPT
        )

        if request.method == "POST":

            setup_script = request.form.get("setup_script")
            try:
                with open(setup_script_path, "w") as f:
                    f.write(setup_script)

            except IOError as io_error:
                current_app.logger.error("Failed to write setup_script %s" % io_error)

            return ""

        else:
            try:
                with open(setup_script_path, "r") as f:
                    return f.read()
            except FileNotFoundError as fnf_error:
                current_app.logger.error("Failed to read setup_script %s" % fnf_error)
                return ""

    @app.route(
        "/async/pipelines/delete/<project_uuid>/<pipeline_uuid>", methods=["DELETE"]
    )
    def pipelines_delete(project_uuid, pipeline_uuid):

        try:
            with TwoPhaseExecutor(db.session) as tpe:
                DeletePipeline(tpe).transaction(project_uuid, pipeline_uuid)
        except Exception as e:
            return {"message": str(e)}, 500

        return jsonify({"success": True})

    @app.route("/async/pipelines/create/<project_uuid>", methods=["POST"])
    def pipelines_create(project_uuid):

        pipeline_path = request.json["pipeline_path"]
        pipeline_name = request.json["name"]

        try:
            with TwoPhaseExecutor(db.session) as tpe:
                CreatePipeline(tpe).transaction(
                    project_uuid, pipeline_name, pipeline_path
                )
        except FileExistsError:
            return (
                jsonify({"message": "A pipeline with the given path already exists."}),
                400,
            )
        except Exception as e:
            return jsonify({"message": str(e)}), 409

        return jsonify({"success": True})

    class ImportGitProjectListResource(Resource):
        def post(self):

            try:
                with TwoPhaseExecutor(db.session) as tpe:
                    task = ImportGitProject(tpe).transaction(
                        request.json["url"], request.json.get("project_name")
                    )
            except Exception as e:
                return jsonify({"message": str(e)}), 500

            return background_task_schema.dump(task)

    api.add_resource(ImportGitProjectListResource, "/async/projects/import-git")

    def discoverFSDeletedProjects():
        """Cleanup projects that were deleted from the filesystem."""

        project_paths = [
            entry.name
            for entry in os.scandir(app.config["PROJECTS_DIR"])
            if entry.is_dir()
        ]

        fs_removed_projects = Project.query.filter(
            Project.path.notin_(project_paths),
            # This way we do not delete a project that is already being
            # deleted twice, and avoid considering a project that is
            # being initialized as deleted from the filesystem.
            Project.status.in_(["READY"]),
        ).all()

        # Use a TwoPhaseExecutor for each project so that issues in one
        # project do not hinder the deletion of others.
        for proj_uuid in [project.uuid for project in fs_removed_projects]:
            try:
                with TwoPhaseExecutor(db.session) as tpe:
                    DeleteProject(tpe).transaction(proj_uuid)
            except Exception as e:
                current_app.logger.error(
                    (
                        "Error during project deletion (discovery) of "
                        f"{proj_uuid}: {e}."
                    )
                )

    def discoverFSCreatedProjects():
        """Detect projects that were added through the file system."""

        # Detect new projects by detecting directories that were not
        # registered in the db as projects.
        existing_project_paths = [project.path for project in Project.query.all()]
        project_paths = [
            entry.name
            for entry in os.scandir(app.config["PROJECTS_DIR"])
            if entry.is_dir()
        ]
        new_project_paths = set(project_paths) - set(existing_project_paths)

        # Use a TwoPhaseExecutor for each project so that issues in one
        # project do not hinder the discovery of others.
        for new_project_path in new_project_paths:
            try:
                with TwoPhaseExecutor(db.session) as tpe:
                    CreateProject(tpe).transaction(new_project_path)
            except Exception as e:
                current_app.logger.error(
                    (
                        "Error during project initialization (discovery) of "
                        f"{new_project_path}: {e}."
                    )
                )

    @app.route("/async/projects/<project_uuid>", methods=["GET"])
    def project_get(project_uuid):
        project = Project.query.filter(Project.uuid == project_uuid).first()

        if project is None:
            return jsonify({"message": "Project doesn't exist."}), 404

        resp = requests.get(
            (
                f'http://{current_app.config["ORCHEST_API_ADDRESS"]}'
                f"/api/projects/{project_uuid}"
            )
        )
        if resp.status_code == 404:
            return (
                jsonify({"message": "Project doesn't exist in the orchest-api."}),
                404,
            )
        elif resp.status_code != 200:
            return (
                jsonify({"message": "Orchest-api project retrieval failed."}),
                resp.status_code,
            )
        else:
            # Merge the project data coming from the orchest-api.
            counts = project_entity_counts(project_uuid, get_job_count=True)
            project = {
                **project.as_dict(),
                **resp.json(),
                **counts,
                "project_snapshot_size": get_project_snapshot_size(project_uuid),
            }

            return jsonify(project)

    @app.route("/async/projects/<project_uuid>", methods=["PUT"])
    def project_put(project_uuid):

        # While this seems suited to be in the orchest_api.py module,
        # I've left it here because some project data lives in the web
        # server as well, and this PUT request might eventually update
        # that.
        resp = requests.put(
            (
                f'http://{current_app.config["ORCHEST_API_ADDRESS"]}'
                f"/api/projects/{project_uuid}"
            ),
            json=request.json,
        )
        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/async/projects", methods=["GET"])
    def projects_get():

        if request.args.get("skip_discovery") != "true":
            discoverFSDeletedProjects()
            discoverFSCreatedProjects()

        # Projects that are in a INITIALIZING or DELETING state won't
        # be shown until ready.
        projects = projects_schema.dump(Project.query.filter_by(status="READY").all())

        if request.args.get("session_counts") == "true":
            session_counts = get_session_counts()

        if request.args.get("job_counts") == "true":
            job_counts = get_job_counts()

        for project in projects:

            # Discover both pipelines of newly initialized projects and
            # manually initialized pipelines of existing projects. Use a
            # a TwoPhaseExecutor for each project so that issues in one
            # project do not hinder the pipeline synchronization of
            # others.
            if request.args.get("skip_discovery") != "true":
                try:
                    with TwoPhaseExecutor(db.session) as tpe:
                        SyncProjectPipelinesDBState(tpe).transaction(project["uuid"])
                except Exception as e:
                    current_app.logger.error(
                        (
                            "Error during project pipelines synchronization of "
                            f'{project["path"]}: {e}.'
                        )
                    )

            counts = project_entity_counts(project["uuid"])
            project.update(counts)

            if request.args.get("session_counts") == "true":
                project.update(
                    {"session_count": session_counts.get(project["uuid"], 0)}
                )

            if request.args.get("job_counts") == "true":
                project.update({"job_count": job_counts.get(project["uuid"], 0)})

        return jsonify(projects)

    @app.route("/async/projects", methods=["POST"])
    def projects_post():

        try:
            with TwoPhaseExecutor(db.session) as tpe:
                CreateProject(tpe).transaction(request.json["name"])
        except Exception as e:

            # The sql integrity error message can be quite ugly.
            if isinstance(e, sqlalchemy.exc.IntegrityError):
                msg = f'Project "{request.json["name"]}" already exists.'
            else:
                msg = str(e)
            return (
                jsonify({"message": msg}),
                500,
            )

        return jsonify({"message": "Project created."})

    @app.route("/async/projects", methods=["DELETE"])
    def projects_delete():

        try:
            with TwoPhaseExecutor(db.session) as tpe:
                DeleteProject(tpe).transaction(request.json["project_uuid"])
        except Exception as e:
            return (
                jsonify({"message": f"Failed to delete the project. Error: {e}"}),
                500,
            )

        return jsonify({"message": "Project deleted."})

    @app.route("/async/pipelines/<project_uuid>/<pipeline_uuid>", methods=["GET"])
    def pipeline_get(project_uuid, pipeline_uuid):

        pipeline = (
            Pipeline.query.filter(Pipeline.project_uuid == project_uuid)
            .filter(Pipeline.uuid == pipeline_uuid)
            .first()
        )

        if pipeline is None:
            return jsonify({"message": "Pipeline doesn't exist."}), 404

        resp = requests.get(
            (
                f'http://{current_app.config["ORCHEST_API_ADDRESS"]}'
                f"/api/pipelines/{project_uuid}/{pipeline_uuid}"
            )
        )
        if resp.status_code == 404:
            return (
                jsonify({"message": "Pipeline doesn't exist in the orchest-api."}),
                404,
            )
        elif resp.status_code != 200:
            return (
                jsonify({"message": "Orchest-api pipeline retrieval failed."}),
                resp.status_code,
            )
        else:
            # Merge the pipeline data coming from the orchest-api.
            pipeline = {**pipeline.as_dict(), **resp.json()}
            return jsonify(pipeline)

    @app.route("/async/pipelines/<project_uuid>/<pipeline_uuid>", methods=["PUT"])
    def pipeline_put(project_uuid, pipeline_uuid):

        # While this seems suited to be in the orchest_api.py module,
        # I've left it here because some pipeline data lives in the web
        # server as well, and this PUT request might eventually update
        # that.
        resp = requests.put(
            (
                f'http://{current_app.config["ORCHEST_API_ADDRESS"]}'
                f"/api/pipelines/{project_uuid}/{pipeline_uuid}"
            ),
            json=request.json,
        )
        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/async/pipelines/<project_uuid>", methods=["GET"])
    def pipelines_get(project_uuid):

        if project_exists(project_uuid):
            return jsonify({"message": "Project could not be found."}), 404

        try:
            with TwoPhaseExecutor(db.session) as tpe:
                SyncProjectPipelinesDBState(tpe).transaction(project_uuid)
        except Exception as e:
            msg = (
                "Error during project pipelines synchronization of "
                f"{project_uuid}: {str(e)}."
            )
            return jsonify({"message": msg}), 500

        pipelines = Pipeline.query.filter(Pipeline.project_uuid == project_uuid).all()
        pipelines_augmented = []

        for pipeline in pipelines:

            pipeline_augmented = {
                "uuid": pipeline.uuid,
                "path": pipeline.path,
            }

            pipeline_json = get_pipeline_json(pipeline.uuid, pipeline.project_uuid)
            if pipeline_json is not None:
                pipeline_augmented["name"] = pipeline_json["name"]
            else:
                pipeline_augmented["name"] = "Warning: pipeline file was not found."

            pipelines_augmented.append(pipeline_augmented)

        json_string = json.dumps({"success": True, "result": pipelines_augmented})

        return json_string, 200, {"content-type": "application/json"}

    @app.route(
        "/async/file-viewer/<project_uuid>/<pipeline_uuid>/<step_uuid>",
        methods=["GET"],
    )
    def file_viewer(project_uuid, pipeline_uuid, step_uuid):

        job_uuid = request.args.get("job_uuid")
        pipeline_run_uuid = request.args.get("pipeline_run_uuid")

        pipeline_json_path = get_pipeline_path(
            pipeline_uuid, project_uuid, job_uuid, pipeline_run_uuid
        )
        pipeline_dir = get_pipeline_directory(
            pipeline_uuid, project_uuid, job_uuid, pipeline_run_uuid
        )

        if os.path.isfile(pipeline_json_path):
            with open(pipeline_json_path, "r") as json_file:
                pipeline_json = json.load(json_file)

            try:
                file_path = os.path.join(
                    pipeline_dir, pipeline_json["steps"][step_uuid]["file_path"]
                )
                filename = pipeline_json["steps"][step_uuid]["file_path"]
                step_title = pipeline_json["steps"][step_uuid]["title"]
            except Exception as e:
                app.logger.info(e)
                return return_404(
                    "Invalid JSON for pipeline %s error: %e" % (pipeline_json_path, e)
                )
        else:
            return return_404(
                "Could not find pipeline.json for pipeline %s" % pipeline_json_path
            )

        file_ext = file_path.split(".")[-1]
        file_content = ""

        if file_ext == "ipynb":
            if os.path.isfile(file_path):
                try:

                    html_exporter = HTMLExporter()
                    (file_content, _) = html_exporter.from_filename(file_path)

                    # custom CSS
                    custom_style = "<style>.CodeMirror pre {overflow: auto}</style>"
                    file_content = file_content.replace(
                        "</head>", custom_style + "</head>", 1
                    )

                except IOError as error:
                    app.logger.info(
                        "Error opening notebook file %s error: %s" % (file_path, error)
                    )
                    return return_404(("Could not find notebook file %s") % file_path)
        else:
            try:
                with open(file_path) as file:
                    file_content = file.read()
            except (IOError, Exception):
                return jsonify({"message": "Could not read file."}), 500

        return jsonify(
            {
                "ext": file_ext,
                "content": file_content,
                "step_title": step_title,
                "filename": filename,
            }
        )

    @app.route(
        "/async/pipelines/json/<project_uuid>/<pipeline_uuid>", methods=["GET", "POST"]
    )
    def pipelines_json(project_uuid, pipeline_uuid):

        pipeline_json_path = get_pipeline_path(
            pipeline_uuid,
            project_uuid,
            request.args.get("job_uuid"),
            request.args.get("pipeline_run_uuid"),
        )

        if request.method == "POST":

            pipeline_directory = get_pipeline_directory(
                pipeline_uuid,
                project_uuid,
                request.args.get("job_uuid"),
                request.args.get("pipeline_run_uuid"),
            )

            # Parse JSON.
            pipeline_json = json.loads(request.form.get("pipeline_json"))

            errors = check_pipeline_correctness(pipeline_json)
            if errors:
                msg = {}
                msg = {"success": False}
                reason = ", ".join([key for key in errors])
                reason = f"Invalid value: {reason}."
                msg["reason"] = reason
                return jsonify(msg), 400

            # Side effect: for each Notebook in de pipeline.json set the
            # correct kernel.
            try:
                pipeline_set_notebook_kernels(
                    pipeline_json, pipeline_directory, project_uuid
                )
            except KeyError:
                msg = {
                    "success": False,
                    "reason": "Invalid Notebook metadata structure.",
                }
                return jsonify(msg), 400

            # Save the pipeline JSON again to make sure its keys are
            # sorted.
            with open(pipeline_json_path, "w") as json_file:
                json.dump(pipeline_json, json_file, indent=4, sort_keys=True)

            # Analytics call.
            send_anonymized_pipeline_definition(app, pipeline_json)

            return jsonify({"success": True, "message": "Successfully saved pipeline."})

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
                with open(pipeline_json_path, "r") as json_file:
                    pipeline_json = json.load(json_file)

                # json.dumps because the front end expects it as a
                # string.
                return jsonify(
                    {"success": True, "pipeline_json": json.dumps(pipeline_json)}
                )

    @app.route(
        "/async/file-picker-tree/pipeline-cwd/<project_uuid>/<pipeline_uuid>",
        methods=["GET"],
    )
    def pipeline_cwd(project_uuid, pipeline_uuid):

        pipeline_dir = get_pipeline_directory(pipeline_uuid, project_uuid)
        project_dir = get_project_directory(project_uuid)
        cwd = pipeline_dir.replace(project_dir, "")

        return jsonify({"cwd": cwd})

    @app.route("/async/file-picker-tree/<project_uuid>", methods=["GET"])
    def get_file_picker_tree(project_uuid):

        allowed_file_extensions = ["ipynb", "R", "py", "sh"]

        project_dir = get_project_directory(project_uuid)

        if not os.path.isdir(project_dir):
            return jsonify({"message": "Project dir %s not found." % project_dir}), 404

        tree = {"type": "directory", "root": True, "name": "/", "children": []}

        dir_nodes = {}

        dir_nodes[project_dir] = tree

        for root, dirs, files in os.walk(project_dir):

            # exclude directories that start with "." from file_picker
            dirs[:] = [dirname for dirname in dirs if not dirname.startswith(".")]

            for dirname in dirs:

                dir_path = os.path.join(root, dirname)
                dir_node = {
                    "type": "directory",
                    "name": dirname,
                    "children": [],
                }

                dir_nodes[dir_path] = dir_node
                dir_nodes[root]["children"].append(dir_node)

            for filename in files:

                if filename.split(".")[-1] in allowed_file_extensions:
                    file_node = {
                        "type": "file",
                        "name": filename,
                    }

                    # this key should always exist
                    try:
                        dir_nodes[root]["children"].append(file_node)
                    except KeyError as e:
                        app.logger.error(
                            "Key %s does not exist in dir_nodes %s. Error: %s"
                            % (root, dir_nodes, e)
                        )
                    except Exception as e:
                        app.logger.error("Error: %e" % e)

        return jsonify(tree)

    @app.route(
        "/async/project-files/create/<project_uuid>/<pipeline_uuid>/<step_uuid>",
        methods=["POST"],
    )
    def create_project_file(project_uuid, pipeline_uuid, step_uuid):
        """Create project file in specified directory within project."""

        project_dir = get_project_directory(project_uuid)

        # Client sends absolute path relative to project root, hence the
        # starting / character is removed.
        file_path = os.path.join(project_dir, request.json["file_path"][1:])

        if os.path.isfile(file_path):
            return jsonify({"message": "File already exists."}), 409
        try:
            create_pipeline_file(
                file_path,
                get_pipeline_json(pipeline_uuid, project_uuid),
                project_dir,
                project_uuid,
                step_uuid,
            )
            return jsonify({"message": "File created."})
        except IOError as e:
            app.logger.error("Could not create file at %s. Error: %s" % (file_path, e))

    @app.route(
        "/async/project-files/exists/<project_uuid>/<pipeline_uuid>", methods=["POST"]
    )
    def project_file_exists(project_uuid, pipeline_uuid):
        """Check whether file exists"""

        pipeline_dir = get_pipeline_directory(pipeline_uuid, project_uuid)
        file_path = os.path.join(pipeline_dir, request.json["relative_path"])

        if os.path.isfile(file_path):
            return jsonify({"message": "File exists."})
        else:
            return jsonify({"message": "File does not exists."}), 404
