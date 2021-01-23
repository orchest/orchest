import json
import os
import uuid

import docker
import sqlalchemy
from flask import json as flask_json
from flask import jsonify, render_template, request
from flask.globals import current_app
from flask_restful import Api, HTTPException, Resource
from nbconvert import HTMLExporter

from _orchest.internals import config as _config
from _orchest.internals.two_phase_executor import TwoPhaseExecutor
from _orchest.internals.utils import run_orchest_ctl
from app.analytics import send_anonymized_pipeline_definition
from app.core.jobs import CreateJob, DeleteJob
from app.core.pipelines import CreatePipeline, DeletePipeline
from app.core.projects import (
    CreateProject,
    DeleteProject,
    ImportGitProject,
    SyncProjectPipelinesDBState,
)
from app.kernel_manager import populate_kernels
from app.models import DataSource, Environment, Job, Pipeline, PipelineRun, Project
from app.schemas import (
    BackgroundTaskSchema,
    DataSourceSchema,
    EnvironmentSchema,
    JobSchema,
    PipelineSchema,
    ProjectSchema,
)
from app.utils import (
    create_pipeline_files,
    delete_environment,
    get_environment,
    get_environment_directory,
    get_environments,
    get_hash,
    get_pipeline_directory,
    get_pipeline_path,
    get_project_directory,
    get_repo_tag,
    get_user_conf,
    get_user_conf_raw,
    pipeline_set_notebook_kernels,
    save_user_conf_raw,
    serialize_environment_to_disk,
)


def register_views(app, db):
    errors = {
        "DataSourceNameInUse": {
            "message": "A data source with this name already exists.",
            "status": 409,
        },
    }

    api = Api(app, errors=errors)

    class DataSourceNameInUse(HTTPException):
        pass

    projects_schema = ProjectSchema(many=True)

    pipeline_schema = PipelineSchema()

    datasource_schema = DataSourceSchema()
    datasources_schema = DataSourceSchema(many=True)

    environment_schema = EnvironmentSchema()
    environments_schema = EnvironmentSchema(many=True)

    job_schema = JobSchema()
    jobs_schema = JobSchema(many=True)

    background_task_schema = BackgroundTaskSchema()

    def register_environments(db, api):
        class EnvironmentsResource(Resource):
            def get(self, project_uuid):
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
                try:
                    db.session.commit()
                except Exception:
                    db.session.rollback()
                    return {"message": "Failed update operation."}, 500

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
                try:
                    db.session.commit()
                except Exception:
                    db.session.rollback()
                    return {"message": "Failed to delete data source."}, 500

                return jsonify({"message": "Data source deletion was successful."})

            def post(self, name):
                if DataSource.query.filter(DataSource.name == name).count() > 0:
                    raise DataSourceNameInUse()

                new_ds = DataSource(
                    name=name,
                    source_type=request.json["source_type"],
                    connection_details=request.json["connection_details"],
                )

                db.session.add(new_ds)
                try:
                    db.session.commit()
                except Exception:
                    db.session.rollback()
                    return {"message": "Failed to create data source."}, 500

                return datasource_schema.dump(new_ds)

        api.add_resource(DataSourcesResource, "/store/datasources")
        api.add_resource(DataSourceResource, "/store/datasources/<string:name>")

    def register_jobs(db, api):
        class JobsResource(Resource):
            def get(self):

                job_query = Job.query

                project_uuid = request.args.get("project_uuid")
                if project_uuid is not None:
                    job_query = job_query.filter(Job.project_uuid == project_uuid)

                jobs = job_query.all()
                return jobs_schema.dump(jobs)

        class JobResource(Resource):
            def put(self, job_uuid):

                ex = Job.query.filter(Job.uuid == job_uuid).first()

                if ex is None:
                    return "", 404

                ex.name = request.json["name"]
                ex.pipeline_uuid = request.json["pipeline_uuid"]
                ex.pipeline_name = request.json["pipeline_name"]
                ex.strategy_json = request.json["strategy_json"]
                ex.draft = request.json["draft"]

                try:
                    db.session.commit()
                except Exception:
                    db.session.rollback()
                    return {"message": "Failed update operation."}, 500

                return job_schema.dump(ex)

            def get(self, job_uuid):
                ex = Job.query.filter(Job.uuid == job_uuid).first()

                if ex is None:
                    return "", 404

                return job_schema.dump(ex)

            def delete(self, job_uuid):

                try:
                    with TwoPhaseExecutor(db.session) as tpe:
                        DeleteJob(tpe).transaction(job_uuid)
                except Exception as e:
                    msg = f"Error during job deletion:{e}"
                    return {"message": msg}, 500

                return jsonify({"message": "Job termination was successful."})

            def post(self, job_uuid):

                project_uuid = request.json["project_uuid"]
                pipeline_uuid = request.json["pipeline_uuid"]
                pipeline_name = request.json["pipeline_name"]
                job_name = request.json["name"]
                draft = request.json["draft"]

                try:
                    with TwoPhaseExecutor(db.session) as tpe:
                        new_exp = CreateJob(tpe).transaction(
                            project_uuid,
                            pipeline_uuid,
                            pipeline_name,
                            job_name,
                            draft,
                        )
                except Exception as e:
                    msg = f"Error during job creation:{e}"
                    return {"message": msg}, 500

                return job_schema.dump(new_exp)

        api.add_resource(JobsResource, "/store/jobs")
        api.add_resource(JobResource, "/store/jobs/<string:job_uuid>")

    register_datasources(db, api)
    register_jobs(db, api)
    register_environments(db, api)

    def return_404(reason=""):
        json_string = json.dumps({"success": False, "reason": reason})

        return json_string, 404, {"content-type": "application/json"}

    @app.route("/", methods=["GET"])
    def index():

        js_bundle_path = os.path.join(
            app.config["STATIC_DIR"], "js", "dist", "main.bundle.js"
        )
        css_bundle_path = os.path.join(
            app.config["STATIC_DIR"], "css", "dist", "main.css"
        )

        front_end_config = [
            "FLASK_ENV",
            "TELEMETRY_DISABLED",
            "ENVIRONMENT_DEFAULTS",
            "ORCHEST_WEB_URLS",
        ]

        front_end_config_internal = ["ORCHEST_SOCKETIO_ENV_BUILDING_NAMESPACE"]

        return render_template(
            "index.html",
            javascript_bundle_hash=get_hash(js_bundle_path),
            css_bundle_hash=get_hash(css_bundle_path),
            user_config=get_user_conf(),
            config_json=flask_json.htmlsafe_dumps(
                {
                    **{key: app.config[key] for key in front_end_config},
                    **{key: getattr(_config, key) for key in front_end_config_internal},
                }
            ),
        )

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
        return get_repo_tag()

    @app.route("/async/user-config", methods=["GET", "POST"])
    def user_config():

        if request.method == "POST":

            config = request.form.get("config")

            try:
                # only save if parseable JSON
                json.loads(config)
                save_user_conf_raw(config)

            except json.JSONDecodeError as e:
                app.logger.debug(e)

            return ""
        else:
            return get_user_conf_raw()

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

    @app.route("/async/pipelineruns/create", methods=["POST"])
    def pipelineruns_create():

        job_uuid = request.json["job_uuid"]

        # Convert a list like [0, 1, 0, 1] to [1, 3].
        selected_indices = [
            i for i, val in enumerate(request.json["selected_indices"]) if val == 1
        ]
        # A list of all the generated runs (even the ones that are not
        # selected). The values of the `selected_indices` correspond to
        # the selected run.
        generated_runs = request.json["generated_pipeline_runs"]

        for i, idx in enumerate(selected_indices):
            # NOTE: the order of the `pipeline_runs` property
            # corresponds to the order of the `selected_indices`.
            pipeline_run = request.json["job_json"]["pipeline_runs"][i]
            pr = PipelineRun(
                uuid=pipeline_run["run_uuid"],
                job=job_uuid,
                parameter_json=generated_runs[idx],
                id=pipeline_run["pipeline_run_id"],
            )

            db.session.add(pr)

        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            return {"message": "Failed to create pipeline runs."}, 500

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
        except Exception as e:
            return jsonify({"message": str(e)}), 409

        return jsonify({"success": True})

    class ImportGitProjectListResource(Resource):
        def post(self):

            try:
                with TwoPhaseExecutor(db.session) as tpe:
                    task = ImportGitProject(tpe).transaction(
                        request.json["url"], request.json.get("name")
                    )
            except Exception as e:
                return jsonify({"message": str(e)}), 500

            return background_task_schema.dump(task)

    api.add_resource(ImportGitProjectListResource, "/async/projects/import-git")

    def discoverFSDeletedProjects():
        """Cleanup projects that were deleted from the filesystem."""

        project_paths = [
            entry.name for entry in os.scandir(app.config["PROJECTS_DIR"]) if entry.is_dir()
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
            entry.name for entry in os.scandir(app.config["PROJECTS_DIR"]) if entry.is_dir()
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

    @app.route("/async/projects", methods=["GET"])
    def projects_get():

        discoverFSDeletedProjects()
        discoverFSCreatedProjects()

        # Projects that are in a INITIALIZING or DELETING state won't
        # be shown until ready.
        projects = projects_schema.dump(Project.query.filter_by(status="READY").all())

        for project in projects:
            # Discover both pipelines of newly initialized projects and
            # manually initialized pipelines of existing projects. Use a
            # a TwoPhaseExecutor for each project so that issues in one
            # project do not hinder the pipeline synchronization of
            # others.
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

            project["pipeline_count"] = Pipeline.query.filter(
                Pipeline.project_uuid == project["uuid"]
            ).count()
            project["job_count"] = Job.query.filter(
                Job.project_uuid == project["uuid"]
            ).count()
            project["environment_count"] = len(get_environments(project["uuid"]))

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
        else:
            return jsonify(pipeline_schema.dump(pipeline))

    @app.route("/async/pipelines/<project_uuid>", methods=["GET"])
    def pipelines_get(project_uuid):

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

            # First create all files part of pipeline_json definition
            # TODO: consider removing other files (no way to do this
            # reliably, special case might be rename).
            create_pipeline_files(pipeline_json, pipeline_directory, project_uuid)

            # Side effect: for each Notebook in de pipeline.json set the
            # correct kernel.
            pipeline_set_notebook_kernels(
                pipeline_json, pipeline_directory, project_uuid
            )

            with open(pipeline_json_path, "w") as json_file:
                json.dump(pipeline_json, json_file, indent=4, sort_keys=True)

            # Analytics call.
            send_anonymized_pipeline_definition(app, pipeline_json)

            return jsonify({"message": "Successfully saved pipeline."})

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

    @app.route("/async/project-files/create/<project_uuid>", methods=["POST"])
    def create_project_file(project_uuid):
        """Create project file in specified directory within project."""

        project_dir = get_project_directory(project_uuid)

        # Client sends absolute path relative to project root, hence the
        # starting / character is removed.
        file_path = os.path.join(project_dir, request.json["file_path"][1:])

        if os.path.isfile(file_path):
            return jsonify({"message": "File already exists."}), 409

        try:
            open(file_path, "a").close()
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
