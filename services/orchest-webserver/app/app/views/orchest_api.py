import requests
import logging
from app.models import PipelineRun
from flask import request, jsonify
from app.utils import (
    project_uuid_to_path,
    get_project_directory,
    pipeline_uuid_to_path,
    get_environments,
    get_pipeline_json,
)

from app.analytics import send_pipeline_run


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
        "/catch/api-proxy/api/environment-builds/most-recent/<project_uuid>/<environment_uuid>",
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

        return resp.content, resp.status_code, resp.headers.items()

    @app.route(
        "/catch/api-proxy/api/environment-images/in-use/<project_uuid>/<environment_uuid>",
        methods=["GET"],
    )
    def catch_api_environment_images_in_use(project_uuid, environment_uuid):

        resp = requests.get(
            "http://"
            + app.config["ORCHEST_API_ADDRESS"]
            + "/api/environment-images/in-use/%s/%s" % (project_uuid, environment_uuid),
        )

        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/experiments/", methods=["POST"])
    def catch_api_proxy_experiments_post():

        json_obj = request.json

        json_obj["pipeline_run_spec"]["run_config"] = {
            "host_user_dir": app.config["HOST_USER_DIR"],
            "project_dir": get_project_directory(
                json_obj["project_uuid"], host_path=True
            ),
            "pipeline_path": pipeline_uuid_to_path(
                json_obj["pipeline_uuid"],
                json_obj["project_uuid"],
            ),
        }

        # Analytics call
        send_pipeline_run(
            app,
            f"{json_obj['project_uuid']}-{json_obj['pipeline_uuid']}",
            get_project_directory(json_obj["project_uuid"]),
            "noninteractive",
        )

        resp = requests.post(
            "http://" + app.config["ORCHEST_API_ADDRESS"] + "/api/experiments/",
            json=json_obj,
        )

        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/sessions/", methods=["POST"])
    def catch_api_proxy_sessions():

        json_obj = request.json

        json_obj["project_dir"] = get_project_directory(
            json_obj["project_uuid"], host_path=True
        )

        json_obj["pipeline_path"] = pipeline_uuid_to_path(
            json_obj["pipeline_uuid"],
            json_obj["project_uuid"],
        )

        json_obj["host_userdir"] = app.config["HOST_USER_DIR"]

        pipeline_json = get_pipeline_json(
            json_obj["pipeline_uuid"], json_obj["project_uuid"]
        )
        json_obj["settings"] = pipeline_json.get("settings", {})

        resp = requests.post(
            "http://" + app.config["ORCHEST_API_ADDRESS"] + "/api/sessions/",
            json=json_obj,
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
                        {"message": "Cannot clear memory while pipeline is running."}
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
            logging.error(
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
                "project_dir": get_project_directory(
                    json_obj["project_uuid"], host_path=True
                ),
                "pipeline_path": pipeline_uuid_to_path(
                    json_obj["pipeline_definition"]["uuid"], json_obj["project_uuid"]
                ),
            }

            # Analytics call
            send_pipeline_run(
                app,
                f"{json_obj['project_uuid']}-{json_obj['pipeline_definition']['uuid']}",
                get_project_directory(json_obj["project_uuid"]),
                "interactive",
            )

            resp = requests.post(
                "http://" + app.config["ORCHEST_API_ADDRESS"] + "/api/runs/",
                json=json_obj,
            )

            return resp.content, resp.status_code, resp.headers.items()

        elif request.method == "GET":

            resp = requests.get(
                "http://"
                + app.config["ORCHEST_API_ADDRESS"]
                + "/api/runs/?"
                + request.query_string.decode(),
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

    @app.route(
        "/catch/api-proxy/api/experiments/<experiment_uuid>/<run_uuid>", methods=["GET"]
    )
    def catch_api_proxy_experiment_runs_single(experiment_uuid, run_uuid):

        resp = requests.get(
            "http://"
            + app.config["ORCHEST_API_ADDRESS"]
            + "/api/experiments/%s/%s" % (experiment_uuid, run_uuid),
        )

        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/experiments/<experiment_uuid>", methods=["GET"])
    def catch_api_proxy_experiments_get(experiment_uuid):

        resp = requests.get(
            "http://"
            + app.config["ORCHEST_API_ADDRESS"]
            + "/api/experiments/"
            + experiment_uuid,
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
            return resp.content, resp.status_code, resp.headers.items()
