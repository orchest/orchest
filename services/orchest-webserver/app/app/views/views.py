import io
import json
import os
import pathlib
import subprocess
import uuid
import zipfile

import requests
import sqlalchemy
from flask import current_app, jsonify, request, send_file
from flask_restful import Api, Resource
from nbconvert import HTMLExporter
from sqlalchemy.orm.exc import NoResultFound

from _orchest.internals import config as _config
from _orchest.internals import errors as _errors
from _orchest.internals import utils as _utils
from _orchest.internals.two_phase_executor import TwoPhaseExecutor
from _orchest.internals.utils import copytree, rmtree
from app import analytics, error
from app.core.filemanager import (
    allowed_file,
    find_unique_duplicate_filepath,
    generate_tree,
    process_request,
    zipdir,
)
from app.core.pipelines import CreatePipeline, DeletePipeline, MovePipeline
from app.core.projects import (
    CreateProject,
    DeleteProject,
    ImportGitProject,
    RenameProject,
    SyncProjectPipelinesDBState,
    discoverFSCreatedProjects,
    discoverFSDeletedProjects,
)
from app.kernel_manager import populate_kernels
from app.models import Environment, Pipeline, Project
from app.schemas import BackgroundTaskSchema, EnvironmentSchema, ProjectSchema
from app.utils import (
    check_pipeline_correctness,
    create_empty_file,
    delete_environment,
    get_environment,
    get_environment_directory,
    get_environments,
    get_job_counts,
    get_orchest_examples_json,
    get_orchest_update_info_json,
    get_pipeline_directory,
    get_pipeline_json,
    get_pipeline_path,
    get_project_directory,
    get_project_snapshot_size,
    get_repo_tag,
    get_session_counts,
    normalize_project_relative_path,
    pipeline_set_notebook_kernels,
    preprocess_script,
    project_entity_counts,
    project_exists,
    resolve_absolute_path,
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
                environment = get_environment(environment_uuid, project_uuid)

                if environment is None:
                    return {"message": "Environment could not be found."}, 404
                else:
                    return environment_schema.dump(environment)

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
                    setup_script=preprocess_script(environment_json["setup_script"]),
                    base_image=environment_json["base_image"],
                    gpu_support=environment_json["gpu_support"],
                )

                # use specified uuid if it's not keyword 'new'
                if environment_uuid != "new":
                    e.uuid = environment_uuid
                else:
                    url = (
                        f'http://{app.config["ORCHEST_API_ADDRESS"]}'
                        f"/api/environments/{project_uuid}"
                    )
                    resp = requests.post(url, json={"uuid": e.uuid})
                    if resp.status_code != 201:
                        return {}, resp.status_code, resp.headers.items()

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

    @app.route("/async/orchest-examples", methods=["GET"])
    def orchest_examples():
        return get_orchest_examples_json()

    @app.route("/async/orchest-update-info", methods=["GET"])
    def orchest_update_info():
        return get_orchest_update_info_json()

    @app.route("/async/server-config", methods=["GET"])
    def server_config():
        front_end_config = [
            "FLASK_ENV",
            "TELEMETRY_DISABLED",
            "ENVIRONMENT_DEFAULTS",
            "ORCHEST_WEB_URLS",
            "CLOUD",
            "GPU_ENABLED_INSTANCE",
            "CLOUD_UNMODIFIABLE_CONFIG_VALUES",
            "INTERCOM_APP_ID",
            "INTERCOM_DEFAULT_SIGNUP_DATE",
        ]

        front_end_config_internal = [
            "ORCHEST_SOCKETIO_ENV_IMG_BUILDING_NAMESPACE",
            "ORCHEST_SOCKETIO_JUPYTER_IMG_BUILDING_NAMESPACE",
            "PIPELINE_PARAMETERS_RESERVED_KEY",
        ]

        user_config = _utils.GlobalOrchestConfig()
        return jsonify(
            {
                "user_config": user_config.as_dict(),
                "config": {
                    **{key: app.config[key] for key in front_end_config},
                    **{key: getattr(_config, key) for key in front_end_config_internal},
                },
            }
        )

    @app.route("/async/restart", methods=["POST"])
    def restart():
        resp = requests.post(
            f'http://{current_app.config["ORCHEST_API_ADDRESS"]}/api/ctl/restart'
        )
        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/async/start-update", methods=["POST"])
    def start_update():

        resp = requests.post(
            f'http://{current_app.config["ORCHEST_API_ADDRESS"]}/api/ctl'
            "/start-update"
        )
        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/heartbeat", methods=["GET"])
    def heartbeat():
        # Don't bubble up the fact that the heartbeat is proxied to the
        # orchest-api to the client.
        requests.get(
            (
                f'http://{current_app.config["ORCHEST_API_ADDRESS"]}/api/info/'
                "client-heartbeat"
            )
        )

        return ""

    @app.route("/async/version", methods=["GET"])
    def version():
        return {"version": get_repo_tag()}

    @app.route("/async/user-config", methods=["GET", "POST"])
    def user_config():

        # Current user config, from disk.
        try:
            current_config = _utils.GlobalOrchestConfig()
        except _errors.CorruptedFileError as e:
            app.logger.error(e, exc_info=True)
            return {"message": "Global user configuration could not be read."}, 500

        if request.method == "GET":
            return {
                "user_config": current_config.as_dict(),
            }

        if request.method == "POST":
            # Updated config, from client.
            config = request.form.get("config")

            if config is None:
                return {"message": "No config was given."}, 400

            try:
                # Only save if parseable JSON.
                config = json.loads(config)
            except json.JSONDecodeError as e:
                app.logger.debug(e, exc_info=True)
                return {"message": "Given config is invalid JSON."}, 400

            try:
                current_config.set(config)
            except (TypeError, ValueError) as e:
                app.logger.debug(e, exc_info=True)
                return {"message": f"{e}"}, 400

            requires_restart = current_config.save(flask_app=app)

            return {
                "requires_restart": requires_restart,
                "user_config": current_config.as_dict(),
            }

    @app.route("/async/host-info", methods=["GET"])
    def host_info():
        disk_info = subprocess.getoutput(
            "df -BKB /userdir --output=size,avail,itotal,fstype | sed -n '2{p;q}'"
        )
        disk_info

        # Incoming data is in kB (-BKB)
        size, avail, total_inodes, fstype = disk_info.strip().split()

        # Remove the "B"
        total_inodes = int(total_inodes[:-1])
        # ext4.
        inode_size = {
            "ext4": 256,
            "small": 128,
            "floppy": 128,
            "hurd": 128,
        }.get(fstype, 256)
        total_inodes_size = total_inodes * inode_size * 1e-9

        # Remove the "kB"
        avail = int(avail[:-2]) * 1e-6
        # Account for the 5% reserved root space, so that used + avail
        # add up to the total disk size the user would see in a file
        # explorer. Moreover, account for inodes.
        total = int(size[:-2]) * 1e-6 + total_inodes_size
        used = total - avail

        host_info = {
            "disk_info": {
                "used_GB": int(used),
                "avail_GB": int(avail),
                "used_pcent": (used / total) * 100,
            }
        }

        return host_info

    @app.route("/async/jupyter-setup-script", methods=["GET", "POST"])
    def jupyter_setup_script():

        setup_script_path = os.path.join(
            app.config["USER_DIR"], _config.JUPYTER_SETUP_SCRIPT
        )

        if request.method == "POST":

            setup_script = request.form.get("setup_script")
            try:
                with open(setup_script_path, "w") as f:
                    f.write(preprocess_script(setup_script))

            except IOError as io_error:
                current_app.logger.error("Failed to write setup_script %s" % io_error)

            return ""

        else:
            try:
                with open(setup_script_path, "r") as f:
                    script = f.read()
                    return jsonify({"script": script if script else ""})
            except FileNotFoundError as fnf_error:
                current_app.logger.error(f"Failed to read setup_script {fnf_error}")
                return ""

    # Deprecated: With the new FileManager, this endpoint is no longer
    # used by FE.
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
                pipeline_uuid = CreatePipeline(tpe).transaction(
                    project_uuid, pipeline_name, pipeline_path
                )
                return jsonify({"pipeline_uuid": pipeline_uuid})

        except FileExistsError:
            return (
                jsonify({"message": "A pipeline with the given path already exists."}),
                400,
            )
        except Exception as e:
            return jsonify({"message": str(e)}), 409

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

        # Move the project on the FS and update the db.
        new_name = request.json.get("name")
        if new_name is not None:
            try:
                with TwoPhaseExecutor(db.session) as tpe:
                    RenameProject(tpe).transaction(project_uuid, new_name)
            except error.ActiveSession:
                return (
                    jsonify(
                        {
                            "message": "Can't rename a project with active sessions.",
                            # TODO: we need a standardized way of
                            # communicating with the frontend.
                            "code": 0,
                        }
                    ),
                    409,
                )
            except sqlalchemy.exc.IntegrityError:
                return (
                    jsonify(
                        {
                            "message": "A project with this name already exists.",
                            "code": 1,
                        }
                    ),
                    409,
                )
            except error.InvalidProjectName:
                return (
                    jsonify(
                        {
                            "message": "Invalid project name.",
                            "code": 2,
                        }
                    ),
                    400,
                )
            except OSError as e:
                if e.errno == 39:
                    return (
                        jsonify(
                            {
                                "message": "Directory exists.",
                                "code": 3,
                            }
                        ),
                        409,
                    )
                # else
                raise e
            except NoResultFound:
                return jsonify({"message": "Project doesn't exist."}), 404
            except Exception as e:
                return (
                    jsonify({"message": f"Failed to rename project: {e}. {type(e)}"}),
                    500,
                )

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
                project_uuid = CreateProject(tpe).transaction(request.json["name"])
                return jsonify({"project_uuid": project_uuid})
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

        path = request.json.get("path")
        if path is not None:
            try:
                with TwoPhaseExecutor(db.session) as tpe:
                    MovePipeline(tpe).transaction(project_uuid, pipeline_uuid, path)
            except error.ActiveSession:
                return (
                    jsonify(
                        {
                            "message": "Can't move a pipeline with active sessions.",
                            "code": 1,
                        }
                    ),
                    409,
                )
            except error.PipelineFileExists:
                return (
                    jsonify({"message": "File exists.", "code": 2}),
                    409,
                )
            except NoResultFound:
                return jsonify({"message": "Pipeline doesn't exist.", "code": 3}), 404
            except ValueError:
                return jsonify({"message": "Invalid file name.", "code": 4}), 409
            except error.PipelineFileDoesNotExist:
                return (
                    jsonify({"message": "Pipeline file doesn't exist.", "code": 5}),
                    409,
                )
            except error.OutOfProjectError:
                return (
                    jsonify(
                        {"message": "Can't move outside of the project.", "code": 6}
                    ),
                    409,
                )
            except Exception as e:
                return (
                    jsonify({"message": f"Failed to move pipeline: {e}.", "code": 0}),
                    500,
                )

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

    @app.route("/async/pipelines", methods=["GET"])
    def pipelines_get_all():

        pipelines = Pipeline.query.all()
        pipelines_augmented = []

        for pipeline in pipelines:

            pipeline_augmented = {
                "uuid": pipeline.uuid,
                "path": pipeline.path,
                "project_uuid": pipeline.project_uuid,
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
                step_file_path = pipeline_json["steps"][step_uuid]["file_path"]

                if step_file_path.startswith("/"):
                    file_path = resolve_absolute_path(step_file_path)
                else:
                    file_path = os.path.join(pipeline_dir, step_file_path)

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

        if request.method == "POST":

            pipeline_json_path = get_pipeline_path(
                pipeline_uuid,
                project_uuid,
                None,
                request.args.get("pipeline_run_uuid"),
            )

            pipeline_directory = get_pipeline_directory(
                pipeline_uuid,
                project_uuid,
                None,
                request.args.get("pipeline_run_uuid"),
            )

            # Parse JSON.
            pipeline_json = json.loads(request.form.get("pipeline_json"))

            # Normalize relative paths.
            for step in pipeline_json["steps"].values():
                if not step["file_path"].startswith("/"):
                    step["file_path"] = normalize_project_relative_path(
                        step["file_path"]
                    )

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

            with open(pipeline_json_path, "r") as json_file:
                old_pipeline_json = json.load(json_file)

            # Save the pipeline JSON again to make sure its keys are
            # sorted.
            with open(pipeline_json_path, "w") as json_file:
                json.dump(pipeline_json, json_file, indent=4, sort_keys=True)

            if old_pipeline_json["name"] != pipeline_json["name"]:
                resp = requests.put(
                    (
                        f'http://{current_app.config["ORCHEST_API_ADDRESS"]}'
                        f"/api/pipelines/{project_uuid}/{pipeline_uuid}"
                    ),
                    json={"name": pipeline_json["name"]},
                )
                if resp.status_code != 200:
                    return (
                        jsonify({"message": "Failed to PUT name to orchest-api."}),
                        resp.status_code,
                    )

            # Analytics call.
            analytics.send_event(
                app,
                analytics.Event.PIPELINE_SAVE,
                {"pipeline_definition": pipeline_json},
            )
            return jsonify({"success": True, "message": "Successfully saved pipeline."})

        elif request.method == "GET":
            pipeline_json_path = get_pipeline_path(
                pipeline_uuid,
                project_uuid,
                request.args.get("job_uuid"),
                request.args.get("pipeline_run_uuid"),
            )

            if not os.path.isfile(pipeline_json_path):
                return (
                    jsonify(
                        {
                            "success": False,
                            "reason": ".orchest file doesn't exist at location "
                            + pipeline_json_path,
                        }
                    ),
                    404,
                )
            else:
                pipeline_json = get_pipeline_json(pipeline_uuid, project_uuid)

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

    @app.route("/async/file-management/create", methods=["POST"])
    def filemanager_create():
        """
        Create an empty file with the given path within `/project-dir`
        or `/data`.
        """
        root = request.args.get("root")
        path = request.args.get("path")
        project_uuid = request.args.get("project_uuid")

        try:
            root_dir_path, _ = process_request(
                root=root, path=path, project_uuid=project_uuid
            )
        except Exception as e:
            return jsonify({"message": str(e)}), 400

        file_path = os.path.join(root_dir_path, path[1:])

        if not file_path.split(".")[-1] in _config.ALLOWED_FILE_EXTENSIONS:
            return jsonify({"message": "Given file type is not supported."}), 409

        directory, _ = os.path.split(file_path)

        if directory:
            os.makedirs(directory, exist_ok=True)

        if os.path.isfile(file_path):
            return jsonify({"message": "File already exists."}), 409
        try:
            create_empty_file(file_path)
            return jsonify({"message": "File created."})
        except IOError as e:
            app.logger.error(f"Could not create file at {file_path}. Error: {e}")

    @app.route("/async/file-management/exists", methods=["GET"])
    def filemanager_exists():
        """Check whether file exists."""

        path = request.args.get("path")
        project_uuid = request.args.get("project_uuid")
        pipeline_uuid = request.args.get("pipeline_uuid")

        # currently this endpoint only handles "/data"
        # if path is absolute
        if path.startswith("/") and not path.startswith("/data"):
            return jsonify({"message": "Illegal file path prefix."}), 400

        file_path = None

        if path.startswith("/"):
            file_path = resolve_absolute_path(path)
        else:
            pipeline_dir = get_pipeline_directory(pipeline_uuid, project_uuid)
            file_path = normalize_project_relative_path(path)
            file_path = os.path.join(pipeline_dir, file_path)

        if file_path is None:
            return jsonify({"message": "Failed to process file_path."}), 500

        if os.path.isfile(file_path):
            return jsonify({"message": "File exists."})
        else:
            return jsonify({"message": "File does not exists."}), 404

    @app.route("/async/file-management/delete", methods=["POST"])
    def filemanager_delete():
        root = request.args.get("root")
        path = request.args.get("path")
        project_uuid = request.args.get("project_uuid")

        try:
            root_dir_path, _ = process_request(
                root=root, path=path, project_uuid=project_uuid
            )
        except Exception as e:
            return jsonify({"message": str(e)}), 400

        # Make absolute path relative
        target_path = os.path.join(root_dir_path, path[1:])

        if target_path == root_dir_path:
            return (
                jsonify(
                    {
                        "message": (
                            "It is not allowed to delete roots "
                            "through the file-manager."
                        )
                    }
                ),
                403,
            )

        if os.path.exists(target_path):
            try:
                rmtree(target_path)
            except Exception:
                return jsonify({"message": "Deletion failed."}), 500
        else:
            return jsonify({"message": "No file or directory at path %s" % path}), 500

        return jsonify({"message": "Success"})

    @app.route("/async/file-management/duplicate", methods=["POST"])
    def filemanager_duplicate():
        root = request.args.get("root")
        path = request.args.get("path")
        project_uuid = request.args.get("project_uuid")

        try:
            root_dir_path, _ = process_request(
                root=root, path=path, project_uuid=project_uuid
            )
        except Exception as e:
            return jsonify({"message": str(e)}), 400

        # Make absolute path relative
        target_path = os.path.join(root_dir_path, path[1:])

        if os.path.isfile(target_path) or os.path.isdir(target_path):
            new_path = find_unique_duplicate_filepath(target_path)
            try:
                if os.path.isfile(target_path):
                    copytree(target_path, new_path)
                else:
                    copytree(target_path, new_path, use_gitignore=False)
            except Exception as e:
                app.logger.error(e)
                return jsonify({"message": "Copy of file/directory failed"}), 500
        else:
            return jsonify({"message": "No file or directory at path %s" % path}), 500

        return jsonify({"message": "Success"})

    @app.route("/async/file-management/create-dir", methods=["POST"])
    def filemanager_create_dir():
        root = request.args.get("root")
        path = request.args.get("path")
        project_uuid = request.args.get("project_uuid")

        try:
            root_dir_path, _ = process_request(
                root=root, path=path, project_uuid=project_uuid
            )
        except Exception as e:
            return jsonify({"message": str(e)}), 400

        # Make absolute path relative
        path = "/".join(path.split("/")[1:])

        full_path = os.path.join(root_dir_path, path)

        if os.path.isdir(full_path) or os.path.isfile(full_path):
            return jsonify({"message": "Path already exists"}), 500

        # even if name ends like an extension, e.g. "my-folder.txt"
        # it will be seen as a folder name
        os.makedirs(full_path, exist_ok=True)
        return jsonify({"message": "Success"})

    @app.route("/async/file-management/upload", methods=["POST"])
    def filemanager_upload():
        root = request.args.get("root")
        path = request.args.get("path")
        project_uuid = request.args.get("project_uuid")

        try:
            root_dir_path, _ = process_request(
                root=root, path=path, project_uuid=project_uuid
            )
        except Exception as e:
            return jsonify({"message": str(e)}), 400

        app.logger.debug(path)

        # check if the post request has the file part
        if "file" not in request.files or request.files["file"].filename == "":
            return jsonify({"message": "No file found"}), 500

        file = request.files["file"]
        if file and allowed_file(file.filename):
            filename = file.filename.split(os.sep)[-1]
            # Trim path for joining (up until this point paths always
            # start and end with a "/")
            path = path[1:]
            dir_path = os.path.join(root_dir_path, path)
            # Create directory if it doesn't exist
            if not os.path.isdir(dir_path):
                os.makedirs(dir_path, exist_ok=True)
            file_path = os.path.join(dir_path, filename)
            file.save(file_path)

        return jsonify({"file_path": file_path})

    @app.route("/async/file-management/rename", methods=["POST"])
    def filemanager_rename():
        old_path = request.args.get("old_path")
        new_path = request.args.get("new_path")
        old_root = request.args.get("old_root")
        new_root = request.args.get("new_root")
        project_uuid = request.args.get("project_uuid")

        try:
            old_root_path, _ = process_request(
                root=old_root, path=new_path, project_uuid=project_uuid
            )
            new_root_path, _ = process_request(
                root=new_root, path=new_path, project_uuid=project_uuid
            )
        except Exception as e:
            return jsonify({"message": str(e)}), 400

        abs_old_path = os.path.join(old_root_path, old_path[1:])
        abs_new_path = os.path.join(new_root_path, new_path[1:])

        try:
            os.rename(abs_old_path, abs_new_path)
            return jsonify({"message": "Success"})
        except Exception:
            return jsonify({"message": "Failed to rename"}), 500

    @app.route("/async/file-management/download", methods=["GET"])
    def filemanager_download():
        root = request.args.get("root")
        path = request.args.get("path")
        project_uuid = request.args.get("project_uuid")

        try:
            root_dir_path, _ = process_request(
                root=root, path=path, project_uuid=project_uuid
            )
        except Exception as e:
            return jsonify({"message": str(e)}), 400

        target_path = os.path.join(root_dir_path, path[1:])

        if os.path.isfile(target_path):
            return send_file(target_path, as_attachment=True)
        else:
            memory_file = io.BytesIO()
            with zipfile.ZipFile(memory_file, "w", zipfile.ZIP_STORED) as zf:
                zipdir(target_path, zf)
            memory_file.seek(0)
            return send_file(
                memory_file,
                mimetype="application/zip",
                as_attachment=True,
                attachment_filename=os.path.basename(target_path[:-1]) + ".zip",
            )

    @app.route("/async/file-management/extension-search", methods=["GET"])
    def filemanager_extension_search():
        root = request.args.get("root")
        path = request.args.get("path")
        project_uuid = request.args.get("project_uuid")
        extensions = request.args.get("extensions")

        try:
            root_dir_path, _ = process_request(
                root=root, path=path, project_uuid=project_uuid
            )
        except Exception as e:
            return jsonify({"message": str(e)}), 400

        if extensions is None:
            return jsonify({"message": "extensions is required."}), 400

        path_filter = path

        extensions = extensions.split(",")

        # Make absolute path relative
        path_filter = path_filter[1:]
        app.logger.info(f"Path filter {path_filter}")

        matches = []

        for extension in extensions:
            matches += list(
                pathlib.Path(os.path.join(root_dir_path, path_filter)).glob(
                    "**/*.{}".format(extension)
                )
            )

        return jsonify(
            {"files": [os.path.relpath(str(match), root_dir_path) for match in matches]}
        )

    @app.route("/async/file-management/browse", methods=["GET"])
    def browse_files():
        root = request.args.get("root")
        path = request.args.get("path")
        depth_as_string = request.args.get("depth")
        project_uuid = request.args.get("project_uuid")

        try:
            root_dir_path, depth = process_request(
                root=root,
                path=path,
                project_uuid=project_uuid,
                depth=depth_as_string,
                is_path_required=False,
            )
        except Exception as e:
            return jsonify({"message": str(e)}), 400

        # Path
        path_filter = path if path else "/"

        app.logger.info(f"Path filter {path_filter}")

        return jsonify(
            generate_tree(root_dir_path, path_filter=path_filter, depth=depth)
        )
