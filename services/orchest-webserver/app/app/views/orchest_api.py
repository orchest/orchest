import requests
from flask import current_app, jsonify, request

from _orchest.internals import analytics
from app import error
from app.core import jobs
from app.models import Pipeline, Project
from app.utils import (
    get_environments,
    get_pipeline_json,
    get_project_directory,
    pipeline_uuid_to_path,
    project_uuid_to_path,
    remove_job_directory,
    request_args_to_string,
)


def api_proxy_environment_image_builds(
    environment_image_build_requests, orchest_api_address
):
    """
    environment_image_build_requests: List[] of
    EnvironmentImageBuildRequest:
    EnvironmentImageBuildRequest = {
        project_uuid:str
        environment_uuid:str
        project_path:str
    }
    """

    json_obj = {"environment_image_build_requests": environment_image_build_requests}

    return requests.post(
        "http://" + orchest_api_address + "/api/environment-builds/",
        json=json_obj,
    )


def register_orchest_api_views(app, db):
    @app.route("/catch/api-proxy/api/validations/environments", methods=["POST"])
    def catch_api_proxy_checks_gate():

        project_uuid = request.json["project_uuid"]

        environment_uuids = [
            environment.uuid for environment in get_environments(project_uuid)
        ]

        resp = requests.post(
            "http://"
            + app.config["ORCHEST_API_ADDRESS"]
            + "/api/validations/environments",
            json={"project_uuid": project_uuid, "environment_uuids": environment_uuids},
        )

        return resp.content, resp.status_code, resp.headers.items()

    @app.route(
        "/catch/api-proxy/api/environment-builds/most-recent"
        + "/<project_uuid>/<environment_uuid>",
        methods=["GET"],
    )
    def catch_api_proxy_environment_image_build_most_recent(
        project_uuid, environment_uuid
    ):

        resp = requests.get(
            "http://"
            + app.config["ORCHEST_API_ADDRESS"]
            + "/api/environment-builds/most-recent/%s/%s"
            % (project_uuid, environment_uuid),
        )

        return resp.content, resp.status_code, resp.headers.items()

    @app.route(
        "/catch/api-proxy/api/environment-builds/<project_uuid>/<environment_uuid>/"
        "<image_tag>",
        methods=["DELETE"],
    )
    def catch_api_proxy_environment_image_build_delete(
        project_uuid,
        environment_uuid,
        image_tag,
    ):

        resp = requests.delete(
            "http://"
            + app.config["ORCHEST_API_ADDRESS"]
            + "/api/environment-builds/%s/%s/%s"
            % (project_uuid, environment_uuid, image_tag),
        )

        return resp.content, resp.status_code, resp.headers.items()

    @app.route(
        "/catch/api-proxy/api/environment-builds/most-recent/<project_uuid>",
        methods=["GET"],
    )
    def catch_api_proxy_environment_image_builds_most_recent(project_uuid):

        resp = requests.get(
            "http://"
            + app.config["ORCHEST_API_ADDRESS"]
            + "/api/environment-builds/most-recent/%s" % project_uuid,
        )

        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/environment-builds", methods=["POST"])
    def catch_api_proxy_environment_image_builds():

        environment_image_build_requests = request.json[
            "environment_image_build_requests"
        ]

        for environment_image_build_request in environment_image_build_requests:
            environment_image_build_request["project_path"] = project_uuid_to_path(
                environment_image_build_request["project_uuid"]
            )

        resp = api_proxy_environment_image_builds(
            environment_image_build_requests, app.config["ORCHEST_API_ADDRESS"]
        )

        return resp.content, resp.status_code, resp.headers.items()

    @app.route(
        "/catch/api-proxy/api/environments/in-use"
        + "/<project_uuid>/<environment_uuid>",
        methods=["GET"],
    )
    def catch_api_environment_images_in_use(project_uuid, environment_uuid):

        resp = requests.get(
            "http://"
            + app.config["ORCHEST_API_ADDRESS"]
            + "/api/environments/in-use/%s/%s" % (project_uuid, environment_uuid),
        )

        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/jupyter-builds", methods=["POST"])
    def catch_api_proxy_jupyter_image_builds_post():
        resp = requests.post(
            "http://" + app.config["ORCHEST_API_ADDRESS"] + "/api/jupyter-builds/",
        )
        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/jupyter-builds/<build_uuid>", methods=["DELETE"])
    def catch_api_proxy_jupyter_image_builds_delete(build_uuid):
        resp = requests.delete(
            "http://"
            + app.config["ORCHEST_API_ADDRESS"]
            + "/api/jupyter-builds/%s" % build_uuid,
        )
        return resp.content, resp.status_code, resp.headers.items()

    @app.route(
        "/catch/api-proxy/api/jupyter-builds/most-recent",
        methods=["GET"],
    )
    def catch_api_proxy_jupyter_image_builds_most_recent():
        resp = requests.get(
            "http://"
            + app.config["ORCHEST_API_ADDRESS"]
            + "/api/jupyter-builds/most-recent/"
        )
        return resp.content, resp.status_code, resp.headers.items()

    environments_missing_msg = (
        "The pipeline definition references environments "
        "that do not exist in the project. "
        "The following environments do not exist:"
        " {missing_environment_uuids}.\n\n Please make sure all"
        " pipeline steps are assigned an environment that exists"
        " in the project."
    )

    @app.route("/catch/api-proxy/api/jobs/", methods=["POST"])
    def catch_api_proxy_jobs_post():

        try:
            job_spec = jobs.create_job_spec(request.json)
        except error.EnvironmentsDoNotExist as e:
            return (
                jsonify(
                    {
                        "message": environments_missing_msg.format(
                            missing_environment_uuids=[",".join(e.environment_uuids)]
                        ),
                    }
                ),
                500,
            )

        resp = requests.post(
            "http://" + current_app.config["ORCHEST_API_ADDRESS"] + "/api/jobs/",
            json=job_spec,
        )

        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/jobs/duplicate", methods=["POST"])
    def catch_api_proxy_jobs_duplicate():

        json_obj = request.json
        try:
            job_spec = jobs.duplicate_job_spec(json_obj["job_uuid"])
        except error.ProjectDoesNotExist:
            msg = (
                "The job cannot be duplicated because its project does "
                "not exist anymore."
            )
            return (
                jsonify({"message": msg}),
                409,
            )
        except error.PipelineDoesNotExist:
            msg = (
                "The job cannot be duplicated because its pipeline does "
                "not exist anymore."
            )
            return (
                jsonify({"message": msg}),
                409,
            )
        except error.JobDoesNotExist:
            msg = "The job cannot be duplicated because it does not exist anymore."
            return (
                jsonify({"message": msg}),
                409,
            )
        except error.EnvironmentsDoNotExist as e:
            return (
                jsonify(
                    {
                        "message": environments_missing_msg.format(
                            missing_environment_uuids=[",".join(e.environment_uuids)]
                        ),
                    }
                ),
                500,
            )

        resp = requests.post(
            "http://" + current_app.config["ORCHEST_API_ADDRESS"] + "/api/jobs/",
            json=job_spec,
        )

        event_type = analytics.Event.ONE_OFF_JOB_DUPLICATED
        if job_spec["cron_schedule"] is not None:
            event_type = analytics.Event.CRON_JOB_DUPLICATED

        analytics.send_event(
            app,
            event_type,
            analytics.TelemetryData(
                event_properties={
                    "project": {
                        "uuid": job_spec["project_uuid"],
                        "job": {
                            "uuid": json_obj["job_uuid"],
                            "new_job_uuid": job_spec["uuid"],
                        },
                    },
                    "duplicate_from": json_obj["job_uuid"],
                    # Deprecated fields, kept to not break the analytics
                    # BE schema.
                    "job_definition": None,
                    "snapshot_size": None,
                    "deprecated": [
                        "duplicated_from",
                        "job_definition",
                        "snapshot_size",
                    ],
                },
                derived_properties={},
            ),
        )
        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/sessions", methods=["GET"])
    def catch_api_proxy_sessions_get():

        resp = requests.get(
            "http://"
            + app.config["ORCHEST_API_ADDRESS"]
            + "/api/sessions/"
            + request_args_to_string(request.args),
        )

        return resp.content, resp.status_code, resp.headers.items()

    @app.route(
        "/catch/api-proxy/api/sessions/<project_uuid>/<pipeline_uuid>",
        methods=["DELETE"],
    )
    def catch_api_proxy_sessions_delete(project_uuid, pipeline_uuid):

        resp = requests.delete(
            "http://"
            + app.config["ORCHEST_API_ADDRESS"]
            + "/api/sessions/%s/%s" % (project_uuid, pipeline_uuid),
        )

        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/sessions", methods=["POST"])
    def catch_api_proxy_sessions_post():

        json_obj = request.json

        project_uuid = json_obj["project_uuid"]
        pipeline_uuid = json_obj["pipeline_uuid"]

        # Lock the project and pipeline row to avoid race conditions
        # with RenameProject and MovePipeline, which are locking for
        # update themselves.
        Project.query.with_for_update().filter(
            Project.uuid == project_uuid,
        ).one()
        Pipeline.query.with_for_update().filter(
            Pipeline.project_uuid == project_uuid,
            Pipeline.uuid == pipeline_uuid,
        ).one()

        pipeline_path = pipeline_uuid_to_path(
            json_obj["pipeline_uuid"],
            json_obj["project_uuid"],
        )

        project_dir = get_project_directory(json_obj["project_uuid"])

        services = get_pipeline_json(
            json_obj["pipeline_uuid"], json_obj["project_uuid"]
        ).get("services", {})

        session_config = {
            "project_uuid": project_uuid,
            "pipeline_uuid": pipeline_uuid,
            "pipeline_path": pipeline_path,
            "project_dir": project_dir,
            "userdir_pvc": app.config["USERDIR_PVC"],
            "services": services,
        }

        resp = requests.post(
            "http://" + app.config["ORCHEST_API_ADDRESS"] + "/api/sessions/",
            json=session_config,
        )

        return resp.content, resp.status_code, resp.headers.items()

    @app.route(
        "/catch/api-proxy/api/sessions/<project_uuid>/<pipeline_uuid>", methods=["PUT"]
    )
    def catch_api_proxy_session_put(project_uuid, pipeline_uuid):

        # check whether session is running
        try:
            resp = requests.get(
                "http://"
                + app.config["ORCHEST_API_ADDRESS"]
                + "/api/runs/?project_uuid=%s&pipeline_uuid=%s"
                % (project_uuid, pipeline_uuid)
            )

            runs = resp.json()["runs"]

            active_runs = False
            for run in runs:
                if run["status"] in ["PENDING", "STARTED"]:
                    active_runs = True

            if active_runs:
                return (
                    jsonify(
                        {
                            "message": (
                                "Cannot restart the memory "
                                "server while the pipeline is running."
                            )
                        }
                    ),
                    423,
                )
            else:
                resp = requests.put(
                    "http://"
                    + app.config["ORCHEST_API_ADDRESS"]
                    + "/api/sessions/%s/%s" % (project_uuid, pipeline_uuid),
                )

                return resp.content, resp.status_code, resp.headers.items()
        except Exception as e:
            app.logger.error(
                "Could not get session information from orchest-api. Error: %s (%s)"
                % (e, type(e))
            )

        return "", 500

    @app.route("/catch/api-proxy/api/runs", methods=["GET", "POST"])
    def catch_api_proxy_runs():

        if request.method == "POST":

            json_obj = request.json

            # add image mapping
            # TODO: replace with dynamic mapping instead of hardcoded
            # All the paths are container path
            json_obj["run_config"] = {
                "userdir_pvc": app.config["USERDIR_PVC"],
                "project_dir": get_project_directory(json_obj["project_uuid"]),
                "pipeline_path": pipeline_uuid_to_path(
                    json_obj["pipeline_definition"]["uuid"], json_obj["project_uuid"]
                ),
                "pipeline_uuid": json_obj["pipeline_definition"]["uuid"],
                "project_uuid": json_obj["project_uuid"],
            }

            resp = requests.post(
                "http://" + app.config["ORCHEST_API_ADDRESS"] + "/api/runs/",
                json=json_obj,
            )

            return resp.content, resp.status_code, resp.headers.items()

        elif request.method == "GET":

            resp = requests.get(
                "http://"
                + app.config["ORCHEST_API_ADDRESS"]
                + "/api/runs/"
                + request_args_to_string(request.args),
            )

            return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/runs/<run_uuid>", methods=["GET", "DELETE"])
    def catch_api_proxy_runs_single(run_uuid):

        if request.method == "GET":

            resp = requests.get(
                "http://"
                + app.config["ORCHEST_API_ADDRESS"]
                + "/api/runs/%s" % run_uuid,
            )

            return resp.content, resp.status_code, resp.headers.items()

        elif request.method == "DELETE":

            resp = requests.delete(
                "http://"
                + app.config["ORCHEST_API_ADDRESS"]
                + "/api/runs/%s" % run_uuid,
            )

            return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/jobs/<job_uuid>", methods=["DELETE"])
    def catch_api_proxy_job_delete(job_uuid):

        resp = requests.delete(
            "http://" + app.config["ORCHEST_API_ADDRESS"] + "/api/jobs/%s" % (job_uuid),
        )

        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/jobs/cronjobs/pause/<job_uuid>", methods=["POST"])
    def catch_api_proxy_job_cronjobs_pause(job_uuid):

        resp = requests.post(
            "http://"
            + app.config["ORCHEST_API_ADDRESS"]
            + "/api/jobs/cronjobs/pause/%s" % (job_uuid),
        )

        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/jobs/cronjobs/resume/<job_uuid>", methods=["POST"])
    def catch_api_proxy_job_cronjobs_resume(job_uuid):

        resp = requests.post(
            "http://"
            + app.config["ORCHEST_API_ADDRESS"]
            + "/api/jobs/cronjobs/resume/%s" % (job_uuid),
        )

        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/jobs/<job_uuid>/runs/trigger", methods=["POST"])
    def catch_api_proxy_job_run_trigger(job_uuid):

        resp = requests.post(
            "http://"
            + app.config["ORCHEST_API_ADDRESS"]
            + f"/api/jobs/{job_uuid}/runs/trigger"
        )

        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/jobs/<job_uuid>", methods=["PUT"])
    def catch_api_proxy_job_put(job_uuid):

        resp = requests.put(
            "http://" + app.config["ORCHEST_API_ADDRESS"] + "/api/jobs/%s" % (job_uuid),
            json=request.json,
        )

        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/jobs/<job_uuid>/<run_uuid>", methods=["GET"])
    def catch_api_proxy_job_runs_single(job_uuid, run_uuid):

        resp = requests.get(
            "http://"
            + app.config["ORCHEST_API_ADDRESS"]
            + "/api/jobs/%s/%s" % (job_uuid, run_uuid),
        )

        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/jobs/<job_uuid>/<run_uuid>", methods=["DELETE"])
    def catch_api_proxy_job_pipeline_run_delete(job_uuid, run_uuid):

        resp = requests.delete(
            "http://"
            + app.config["ORCHEST_API_ADDRESS"]
            + "/api/jobs/%s/%s" % (job_uuid, run_uuid),
        )

        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/jobs/<job_uuid>/pipeline_runs", methods=["GET"])
    def catch_api_proxy_job_pipeline_runs(job_uuid):

        resp = requests.get(
            "http://"
            + app.config["ORCHEST_API_ADDRESS"]
            + "/api/jobs/%s/pipeline_runs" % (job_uuid)
            + request_args_to_string(request.args)
        )

        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/jobs/<job_uuid>", methods=["get"])
    def catch_api_proxy_jobs_get(job_uuid):

        resp = requests.get(
            "http://"
            + app.config["ORCHEST_API_ADDRESS"]
            + "/api/jobs/"
            + job_uuid
            + request_args_to_string(request.args),
        )

        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/jobs/", methods=["get"])
    def catch_api_proxy_jobs_get_all():

        resp = requests.get(
            f'http://{app.config["ORCHEST_API_ADDRESS"]}/api/jobs/'
            + request_args_to_string(request.args)
        )

        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/jobs/cleanup/<job_uuid>", methods=["delete"])
    def catch_api_proxy_jobs_cleanup(job_uuid):
        try:
            # Get data before issuing deletion to the orchest-api. This
            # is needed to retrieve the job pipeline uuid and project
            # uuid. TODO: if the caller of the job knows about those
            # ids, we could avoid making a request to the orchest-api.
            resp = requests.get(
                (
                    f'http://{current_app.config["ORCHEST_API_ADDRESS"]}/api'
                    f"/jobs/{job_uuid}"
                )
            )
            data = resp.json()

            if resp.status_code == 200:
                pipeline_uuid = data["pipeline_uuid"]
                project_uuid = data["project_uuid"]

                # Tell the orchest-api that the job does not exist
                # anymore, will be stopped if necessary then cleaned up
                # from the orchest-api db.
                resp = requests.delete(
                    f"http://{current_app.config['ORCHEST_API_ADDRESS']}/api/"
                    f"jobs/cleanup/{job_uuid}"
                )

                remove_job_directory(job_uuid, pipeline_uuid, project_uuid)
                return resp.content, resp.status_code, resp.headers.items()

            elif resp.status_code == 404:
                raise ValueError(f"Job {job_uuid} does not exist.")
            else:
                raise Exception(f"{data}, {resp.status_code}")

        except Exception as e:
            msg = f"Error during job deletion:{e}"
            return {"message": msg}, 500

    @app.route(
        "/catch/api-proxy/api/jobs/cleanup/<job_uuid>/<run_uuid>", methods=["delete"]
    )
    def catch_api_proxy_job_pipeline_run_cleanup(job_uuid, run_uuid):
        resp = requests.delete(
            f"http://{current_app.config['ORCHEST_API_ADDRESS']}/api/"
            f"jobs/cleanup/{job_uuid}/{run_uuid}"
        )
        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/jobs/next_scheduled_job", methods=["get"])
    def catch_api_proxy_jobs_next_scheduled_job():
        resp = requests.get(
            f'http://{app.config["ORCHEST_API_ADDRESS"]}/api/jobs/next_scheduled_job'
            + request_args_to_string(request.args)
        )
        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/idle", methods=["GET"])
    def catch_idle_check_get():
        resp = requests.get(
            (f'http://{current_app.config["ORCHEST_API_ADDRESS"]}/api/info/idle')
        )
        return resp.content, resp.status_code, resp.headers.items()

    @app.route(
        "/catch/api-proxy/api/notifications/<path:path>",
        methods=["GET", "POST", "PUT", "DELETE"],
    )
    def catch_api_proxy_notifications(path):
        # Note: doesn't preserve query args atm.
        req_json = request.get_json() if request.is_json else None
        resp = requests.request(
            method=request.method,
            url=(
                f'http://{current_app.config["ORCHEST_API_ADDRESS"]}'
                f"/api/notifications/{path}"
            ),
            json=req_json,
        )

        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/ctl/cleanup-builder-cache", methods=["POST"])
    def catch_api_proxy_ctl_cleanup_builder_cache():
        resp = requests.post(
            f"http://{current_app.config['ORCHEST_API_ADDRESS']}/api/"
            f"ctl/cleanup-builder-cache"
        )
        return resp.content, resp.status_code, resp.headers.items()
