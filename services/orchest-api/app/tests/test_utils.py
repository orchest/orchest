from _orchest.internals.test_utils import uuid4


def create_env_build_request(project_uuid, n):
    request = {"environment_build_requests": []}

    for _ in range(n):
        request["environment_build_requests"].append(
            {
                "project_uuid": project_uuid,
                "project_path": "project_path",
                "environment_uuid": uuid4(),
            }
        )

    return request


def create_pipeline_run_spec(project_uuid, pipeline_uuid, n_steps=1):
    steps = {}
    for i in range(n_steps):
        step = {
            "incoming_connections": [],
            "name": f"step-{i}",
            "uuid": f"uuid-{i}",
            "file_path": "",
            "environment": 0.3,
        }
        steps[f"uuid-{i}"] = step

    return {
        "pipeline_definition": {
            "name": "pipeline-name",
            "project_uuid": project_uuid,
            "uuid": pipeline_uuid,
            "settings": {},
            "parameters": {},
            "steps": steps,
        },
        "uuids": [],
        "project_uuid": project_uuid,
        "run_type": "full",
        "run_config": {},
    }


def create_job_spec(
    project_uuid,
    pipeline_uuid,
    cron_schedule=None,
    scheduled_start=None,
    parameters=[{}],
    pipeline_run_spec=None,
):
    if pipeline_run_spec is None:
        pipeline_run_spec = create_pipeline_run_spec(project_uuid, pipeline_uuid)

    job_spec = {
        "uuid": uuid4(),
        "name": "job-name",
        "project_uuid": project_uuid,
        "pipeline_uuid": pipeline_uuid,
        "pipeline_name": "pipeline-name",
        "cron_schedule": cron_schedule,
        "parameters": parameters,
        "pipeline_definition": pipeline_run_spec["pipeline_definition"],
        "pipeline_run_spec": pipeline_run_spec,
        "scheduled_start": scheduled_start,
        "strategy_json": {},
    }
    return job_spec


class Project:
    def __init__(self, client, uuid, env_variables=None):
        self.uuid = uuid
        project = {"uuid": self.uuid, "env_variables": env_variables}
        if env_variables is None:
            project["env_variables"] = {}

        client.post("/api/projects/", json=project)


class Pipeline:
    def __init__(self, client, proj, uuid, env_variables=None):
        self.project = proj
        self.uuid = uuid
        pipeline = {
            "project_uuid": proj.uuid,
            "uuid": self.uuid,
            "env_variables": env_variables,
        }
        if env_variables is None:
            pipeline["env_variables"] = {}

        client.post("/api/pipelines/", json=pipeline)


class InteractiveSession:
    def __init__(self, client, pipeline):
        self.project = pipeline.project
        self.pipeline = pipeline

        session_request_spec = {
            "project_uuid": pipeline.project.uuid,
            "pipeline_uuid": pipeline.uuid,
            "pipeline_path": "pip_path",
            "project_dir": "project_dir",
            "host_userdir": "host_userdir",
        }
        client.post("/api/sessions/", json=session_request_spec)


class InteractiveRun:
    def __init__(self, client, pipeline):
        self.project = pipeline.project
        self.pipeline = pipeline
        spec = create_pipeline_run_spec(self.project.uuid, self.pipeline.uuid)
        self.uuid = client.post("/api/runs/", json=spec).get_json()["uuid"]


class Job:
    def __init__(self, client, pipeline):
        self.project = pipeline.project
        self.pipeline = pipeline
        job_spec = create_job_spec(self.project.uuid, self.pipeline.uuid)

        self.uuid = client.post("/api/jobs/", json=job_spec).get_json()["uuid"]


class EnvironmentBuild:
    def __init__(self, client, project):
        self.project = project
        req = create_env_build_request(project.uuid, 1)
        self.environment_uuid = req["environment_build_requests"][0]["environment_uuid"]

        data = client.post("/api/environment-builds/", json=req).get_json()
        self.uuid = data["environment_builds"][0]["uuid"]
