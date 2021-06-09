import json
import time

from _orchest.internals.test_utils import gen_uuid


def mocked_abortable_async_result(abort):
    class MockAbortableAsyncResult:
        def __init__(self, task_uuid) -> None:
            pass

        def is_aborted(self):
            return abort

    return MockAbortableAsyncResult


def mocked_docker_client(_NOT_TO_BE_LOGGED, build_events):
    class MockDockerClient:
        def __init__(self):
            # A way to mock this kind of properties:
            # docker_client.images.get(build_context["base_image"])
            self.images = self
            self.api = self

        @staticmethod
        def from_env():
            return MockDockerClient()

        # Will be used as docker_client.images.get(...).
        def get(self, *args, **kwargs):
            pass

        # Will be used as docker_client.api.build(...).
        def build(self, path, tag, *args, **kwargs):

            # The env build process should only log events/data between
            # the flags.
            events = (
                [_NOT_TO_BE_LOGGED]
                + ["_ORCHEST_RESERVED_FLAG_"]
                + build_events
                + ["_ORCHEST_RESERVED_FLAG_"]
                + [_NOT_TO_BE_LOGGED]
            )

            data = []
            for event in events:
                if event is None:
                    event = {"error": "error"}
                else:
                    event = {"stream": event + "\n"}
                data.append(json.dumps(event))

            # This way tasks can be aborted, otherwise it might be done
            # building an image before the parent process has the chance
            # to check if it has been aborted.
            time.sleep(0.5)
            return iter(data)

    return MockDockerClient


def mocked_socketio_class(socketio_data):
    class MockSocketIOClient:
        def __init__(self, *args, **kwargs) -> None:
            self.on_connect = None

        def connect(self, *args, **kwargs):
            socketio_data["has_connected"] = True
            self.on_connect()

        def sleep(self, *args, **kwargs):
            time.sleep(args[0])

        def disconnect(self, *args, **kwargs):
            socketio_data["has_disconnected"] = True

        def emit(self, name, data, *args, **kwargs):
            if "output" in data:
                socketio_data["output_logs"].append(data["output"])
            # disconnect is passed as a callback
            if "callback" in kwargs:
                kwargs["callback"]()

        def on(self, event, *args, **kwargs):
            if event == "connect":

                def set_handler(handler):
                    self.on_connect = handler
                    return handler

                return set_handler

    return MockSocketIOClient


class MockRequestReponse:
    def __enter__(self):
        return self

    def __exit__(self, *args, **kwargs):
        pass

    def json(self):
        pass


def create_env_build_request(project_uuid, n):
    request = {"environment_build_requests": []}

    for _ in range(n):
        request["environment_build_requests"].append(
            {
                "project_uuid": project_uuid,
                "project_path": "project_path",
                "environment_uuid": gen_uuid(),
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
            "environment": "my-env",
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
        "uuid": gen_uuid(),
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

    @property
    def project_uuid(self):
        return self.project.uuid

    @property
    def pipeline_uuid(self):
        return self.pipeline.uuid


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


class EagerScheduler:
    def __init__(self, *args, **kwargs):
        pass

    def start(self):
        pass

    def add_job(self, func, args=None, kwargs=None, *myargs, **mykwargs):
        args = () if args is None else args
        kwargs = {} if kwargs is None else kwargs
        func(*args, **kwargs)
