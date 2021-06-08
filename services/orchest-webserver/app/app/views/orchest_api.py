import uuid

import requests
from flask import current_app, jsonify, request

from app import analytics
from app.utils import (
    create_job_directory,
    get_environments,
    get_environments_from_pipeline_json,
    get_pipeline_json,
    get_project_directory,
    pipeline_uuid_to_path,
    project_uuid_to_path,
    remove_job_directory,
    request_args_to_string,
)


def api_proxy_environment_builds(environment_build_requests, orchest_api_address):
    """
    environment_build_requests: List[] of EnvironmentBuildRequest
    EnvironmentBuildRequest = {
        project_uuid:str
        environment_uuid:str
        project_path:str
    }
    """

    json_obj = {"environment_build_requests": environment_build_requests}

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
    def catch_api_proxy_environment_build_most_recent(project_uuid, environment_uuid):

        resp = requests.get(
            "http://"
            + app.config["ORCHEST_API_ADDRESS"]
            + "/api/environment-builds/most-recent/%s/%s"
            % (project_uuid, environment_uuid),
        )

        return resp.content, resp.status_code, resp.headers.items()

    @app.route(
        "/catch/api-proxy/api/environment-builds/<environment_build_uuid>",
        methods=["DELETE"],
    )
    def catch_api_proxy_environment_build_delete(environment_build_uuid):

        resp = requests.delete(
            "http://"
            + app.config["ORCHEST_API_ADDRESS"]
            + "/api/environment-builds/%s" % (environment_build_uuid),
        )

        analytics.send_env_build_cancel(app, environment_build_uuid)
        return resp.content, resp.status_code, resp.headers.items()

    @app.route(
        "/catch/api-proxy/api/environment-builds/most-recent/<project_uuid>",
        methods=["GET"],
    )
    def catch_api_proxy_environment_builds_most_recent(project_uuid):

        resp = requests.get(
            "http://"
            + app.config["ORCHEST_API_ADDRESS"]
            + "/api/environment-builds/most-recent/%s" % project_uuid,
        )

        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/environment-builds", methods=["POST"])
    def catch_api_proxy_environment_builds():

        environment_build_requests = request.json["environment_build_requests"]

        for environment_build_request in environment_build_requests:
            environment_build_request["project_path"] = project_uuid_to_path(
                environment_build_request["project_uuid"]
            )

        resp = api_proxy_environment_builds(
            environment_build_requests, app.config["ORCHEST_API_ADDRESS"]
        )

        for environment_build_request in environment_build_requests:
            analytics.send_env_build_start(app, environment_build_request)
        return resp.content, resp.status_code, resp.headers.items()

    @app.route(
        "/catch/api-proxy/api/environment-images/in-use"
        + "/<project_uuid>/<environment_uuid>",
        methods=["GET"],
    )
    def catch_api_environment_images_in_use(project_uuid, environment_uuid):

        resp = requests.get(
            "http://"
            + app.config["ORCHEST_API_ADDRESS"]
            + "/api/environment-images/in-use/%s/%s" % (project_uuid, environment_uuid),
        )

        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/jupyter-builds", methods=["POST"])
    def catch_api_proxy_jupyter_builds_post():
        resp = requests.post(
            "http://" + app.config["ORCHEST_API_ADDRESS"] + "/api/jupyter-builds/",
        )
        analytics.send_event(app, "jupyter-build start", {})
        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/jupyter-builds/<build_uuid>", methods=["DELETE"])
    def catch_api_proxy_jupyter_builds_delete(build_uuid):
        resp = requests.delete(
            "http://"
            + app.config["ORCHEST_API_ADDRESS"]
            + "/api/jupyter-builds/%s" % build_uuid,
        )
        analytics.send_event(app, "jupyter-build cancel", {})
        return resp.content, resp.status_code, resp.headers.items()

    @app.route(
        "/catch/api-proxy/api/jupyter-builds/most-recent",
        methods=["GET"],
    )
    def catch_api_proxy_jupyter_builds_most_recent():
        resp = requests.get(
            "http://"
            + app.config["ORCHEST_API_ADDRESS"]
            + "/api/jupyter-builds/most-recent/"
        )
        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/jobs/", methods=["POST"])
    def catch_api_proxy_jobs_post():

        json_obj = request.json

        pipeline_path = pipeline_uuid_to_path(
            json_obj["pipeline_uuid"], json_obj["project_uuid"]
        )
        json_obj["pipeline_run_spec"]["run_config"] = {
            "host_user_dir": app.config["HOST_USER_DIR"],
            "project_dir": get_project_directory(
                json_obj["project_uuid"], host_path=True
            ),
            "pipeline_path": pipeline_path,
        }

        json_obj["pipeline_definition"] = get_pipeline_json(
            json_obj["pipeline_uuid"], json_obj["project_uuid"]
        )

        # Validate whether the pipeline contains environments
        # that do not exist in the project.
        project_environments = get_environments(json_obj["project_uuid"])
        project_environment_uuids = set(
            [environment.uuid for environment in project_environments]
        )
        pipeline_environment_uuids = get_environments_from_pipeline_json(
            json_obj["pipeline_definition"]
        )

        missing_environment_uuids = (
            pipeline_environment_uuids - project_environment_uuids
        )
        if len(missing_environment_uuids) > 0:
            missing_environment_uuids_str = ", ".join(missing_environment_uuids)
            return (
                jsonify(
                    {
                        "message": "The pipeline definition references environments "
                        f"that do not exist in the project. "
                        "The following environments do not exist:"
                        f" [{missing_environment_uuids_str}].\n\n Please make sure all"
                        " pipeline steps are assigned an environment that exists"
                        " in the project."
                    }
                ),
                500,
            )

        # Jobs should always have eviction enabled.
        json_obj["pipeline_definition"]["settings"]["auto_eviction"] = True

        job_uuid = str(uuid.uuid4())
        json_obj["uuid"] = job_uuid
        create_job_directory(
            job_uuid, json_obj["pipeline_uuid"], json_obj["project_uuid"]
        )

        resp = requests.post(
            "http://" + app.config["ORCHEST_API_ADDRESS"] + "/api/jobs/",
            json=json_obj,
        )

        analytics.send_job_create(app, json_obj)
        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/sessions/", methods=["GET"])
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

        analytics.send_session_stop(app, project_uuid, pipeline_uuid)
        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/sessions/", methods=["POST"])
    def catch_api_proxy_sessions_post():

        json_obj = request.json

        project_uuid = json_obj["project_uuid"]
        pipeline_uuid = json_obj["pipeline_uuid"]

        pipeline_path = pipeline_uuid_to_path(
            json_obj["pipeline_uuid"],
            json_obj["project_uuid"],
        )

        project_dir = get_project_directory(json_obj["project_uuid"], host_path=True)

        services = get_pipeline_json(
            json_obj["pipeline_uuid"], json_obj["project_uuid"]
        ).get("services", {})

        session_config = {
            "project_uuid": project_uuid,
            "pipeline_uuid": pipeline_uuid,
            "pipeline_path": pipeline_path,
            "project_dir": project_dir,
            "host_userdir": app.config["HOST_USER_DIR"],
            "services": services,
        }

        resp = requests.post(
            "http://" + app.config["ORCHEST_API_ADDRESS"] + "/api/sessions/",
            json=session_config,
        )

        analytics.send_session_start(app, session_config)
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
                analytics.send_session_restart(
                    app,
                    project_uuid,
                    pipeline_uuid,
                    # So that we know when users attempt to restart a
                    # session without success.
                    True,
                )
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

                analytics.send_session_restart(app, project_uuid, pipeline_uuid, False)
                return resp.content, resp.status_code, resp.headers.items()
        except Exception as e:
            app.logger.error(
                "Could not get session information from orchest-api. Error: %s (%s)"
                % (e, type(e))
            )

        return "", 500

    @app.route("/catch/api-proxy/api/runs/", methods=["GET", "POST"])
    def catch_api_proxy_runs():

        if request.method == "POST":

            json_obj = request.json

            # add image mapping
            # TODO: replace with dynamic mapping instead of hardcoded
            json_obj["run_config"] = {
                "host_user_dir": app.config["HOST_USER_DIR"],
                "project_dir": get_project_directory(
                    json_obj["project_uuid"], host_path=True
                ),
                "pipeline_path": pipeline_uuid_to_path(
                    json_obj["pipeline_definition"]["uuid"], json_obj["project_uuid"]
                ),
            }

            resp = requests.post(
                "http://" + app.config["ORCHEST_API_ADDRESS"] + "/api/runs/",
                json=json_obj,
            )

            analytics.send_pipeline_run_start(
                app,
                f"{json_obj['project_uuid']}-{json_obj['pipeline_definition']['uuid']}",
                get_project_directory(json_obj["project_uuid"]),
                "interactive",
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

            analytics.send_pipeline_run_cancel(
                app,
                run_uuid,
                "interactive",
            )
            return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/jobs/<job_uuid>", methods=["DELETE"])
    def catch_api_proxy_job_delete(job_uuid):

        resp = requests.delete(
            "http://" + app.config["ORCHEST_API_ADDRESS"] + "/api/jobs/%s" % (job_uuid),
        )

        analytics.send_job_cancel(app, job_uuid)
        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/jobs/<job_uuid>", methods=["PUT"])
    def catch_api_proxy_job_put(job_uuid):

        resp = requests.put(
            "http://" + app.config["ORCHEST_API_ADDRESS"] + "/api/jobs/%s" % (job_uuid),
            json=request.json,
        )

        analytics.send_job_update(app, job_uuid, request.json)
        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/jobs/<job_uuid>/<run_uuid>", methods=["GET"])
    def catch_api_proxy_job_runs_single(job_uuid, run_uuid):

        resp = requests.get(
            "http://"
            + app.config["ORCHEST_API_ADDRESS"]
            + "/api/jobs/%s/%s" % (job_uuid, run_uuid),
        )

        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/jobs/<job_uuid>", methods=["get"])
    def catch_api_proxy_jobs_get(job_uuid):

        resp = requests.get(
            "http://" + app.config["ORCHEST_API_ADDRESS"] + "/api/jobs/" + job_uuid,
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
                analytics.send_job_delete(app, job_uuid)
                return resp.content, resp.status_code, resp.headers.items()

            elif resp.status_code == 404:
                raise ValueError(f"Job {job_uuid} does not exist.")
            else:
                raise Exception(f"{data}, {resp.status_code}")

        except Exception as e:
            msg = f"Error during job deletion:{e}"
            return {"message": msg}, 500
