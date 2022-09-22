import requests
from flask import current_app, jsonify, request

from app import error
from app.core import jobs
from app.models import Pipeline, Project
from app.utils import (
    get_environments,
    get_pipeline_json,
    get_project_directory,
    pipeline_uuid_to_path,
    project_uuid_to_path,
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

    # The cloud BE depends on this endpoint for some functionality,
    # handle with care.
    @app.route("/catch/api-proxy/api/jobs", methods=["POST"])
    def catch_api_proxy_jobs_post():

        try:
            resp = jobs.create_job(request.json)
            return resp.content, resp.status_code, resp.headers.items()
        except (error.OrchestApiRequestError) as e:

            return (
                jsonify(e),
                409,
            )

    @app.route("/catch/api-proxy/api/jobs/duplicate", methods=["POST"])
    def catch_api_proxy_jobs_duplicate():

        json_obj = request.json
        try:
            resp = jobs.duplicate_job(json_obj["job_uuid"])
            return resp.content, resp.status_code, resp.headers.items()
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

        # Side effect of a session post is to create an environment
        # shell this is a "client decision" hence it's not handled
        # automatically by the orchest-api.
        project_envs = get_environments(project_uuid)
        if len(project_envs) > 0 and resp.status_code == 201:
            # We use the first environment that gets
            # passed by the endpoint as it's
            # assumed to be the "default" environment
            # for this project. Currently, we
            # don't explicitly encode which
            # environment is the default. So we
            # depend on the result being a list
            # (ordered).
            json_data = {
                "pipeline_uuid": pipeline_uuid,
                "pipeline_path": pipeline_path,
                "project_uuid": project_uuid,
                "environment_uuid": project_envs[0].uuid,
                "userdir_pvc": app.config["USERDIR_PVC"],
                "project_dir": project_dir,
            }

            url = (
                "http://"
                + app.config["ORCHEST_API_ADDRESS"]
                + "/api/environment-shells/"
            )

            current_app.config["SCHEDULER"].add_job(
                requests.post, args=[url], kwargs={"json": json_data}
            )

        return resp.content, resp.status_code, resp.headers.items()

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

    @app.route("/catch/api-proxy/api/jobs/<job_uuid>/pipeline", methods=["PUT"])
    def catch_api_proxy_job_pipeline_put(job_uuid):

        resp = jobs.change_draft_job_pipeline(job_uuid, request.json["pipeline_uuid"])
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

    @app.route("/catch/api-proxy/api/jobs", methods=["get"])
    def catch_api_proxy_jobs_get_all():

        resp = requests.get(
            f'http://{app.config["ORCHEST_API_ADDRESS"]}/api/jobs/'
            + request_args_to_string(request.args)
        )

        return resp.content, resp.status_code, resp.headers.items()

    @app.route("/catch/api-proxy/api/jobs/cleanup/<job_uuid>", methods=["delete"])
    def catch_api_proxy_jobs_cleanup(job_uuid):
        try:
            resp = requests.get(
                (
                    f'http://{current_app.config["ORCHEST_API_ADDRESS"]}/api'
                    f"/jobs/{job_uuid}"
                )
            )
            job = resp.json()

            if resp.status_code == 200:
                # Will delete the job as a collateral effect.
                jobs.remove_job_directory(
                    job_uuid,
                    job["pipeline_uuid"],
                    job["project_uuid"],
                    job["snapshot_uuid"],
                )

                return resp.content, resp.status_code, resp.headers.items()

            elif resp.status_code == 404:
                raise ValueError(f"Job {job_uuid} does not exist.")
            else:
                raise error.OrchestApiRequestError(response=resp)

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

    @app.route("/catch/api-proxy/api/snapshots/<snapshot_uuid>", methods=["GET"])
    def catch_api_proxy_snapshots_get_snapshot(snapshot_uuid: str):
        resp = requests.get(
            f"http://{current_app.config['ORCHEST_API_ADDRESS']}/api/"
            f"snapshots/{snapshot_uuid}"
        )
        return resp.content, resp.status_code, resp.headers.items()
