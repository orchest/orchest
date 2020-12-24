import requests
import json
import time

import docker
import pytest
import socketio

import app.core.environment_builds
import app.connections


@pytest.fixture(
    params=[
        {
            "task_uuid": 5,
            "image_in_local_environment": True,
            "abort": False,
            "build_events": [],
        },
        {
            "task_uuid": 5,
            "image_in_local_environment": True,
            "abort": True,
            "build_events": [],
        },
        {
            "task_uuid": 5,
            "image_in_local_environment": False,
            "abort": True,
            "build_events": [],
        },
        {
            "task_uuid": 5,
            "image_in_local_environment": False,
            "abort": False,
            "build_events": [],
        },
        {
            "task_uuid": 5,
            "image_in_local_environment": True,
            "abort": False,
            "build_events": [None],
        },
        {
            "task_uuid": 5,
            "image_in_local_environment": True,
            "abort": True,
            "build_events": [None],
        },
        {
            "task_uuid": 5,
            "image_in_local_environment": False,
            "abort": True,
            "build_events": [None],
        },
        {
            "task_uuid": 5,
            "image_in_local_environment": False,
            "abort": False,
            "build_events": [None],
        },
        {
            "task_uuid": 1,
            "image_in_local_environment": True,
            "abort": False,
            "build_events": [1, 2, 3, 4],
        },
        {
            "task_uuid": 2,
            "image_in_local_environment": True,
            "abort": True,
            "build_events": [1, 2, 3, 4],
        },
        {
            "task_uuid": 3,
            "image_in_local_environment": False,
            "abort": True,
            "build_events": [1, 2, 3, 4],
        },
        {
            "task_uuid": 4,
            "image_in_local_environment": False,
            "abort": False,
            "build_events": [1, 2, 3, 4],
        },
        {
            "task_uuid": 5,
            "image_in_local_environment": False,
            "abort": False,
            "build_events": [1, 2, 3, 4, None],
        },
    ]
)
def testio(request):
    param = request.param
    param["task_uuid"] = str(param["task_uuid"])
    param["project_uuid"] = str(param["task_uuid"])
    param["environment_uuid"] = str(param["task_uuid"])
    param["project_path"] = str(param["task_uuid"])
    events = []
    for event in param["build_events"]:
        if event is None:
            events.append(event)
        else:
            events.append(str(event))
    param["build_events"] = events

    return param


class MockRequestReponse:
    def __enter__(self):
        return self

    def __exit__(self, *args, **kwargs):
        pass

    def json(self):
        pass


# String that should not appear in the logs.
_NOT_TO_BE_LOGGED = "_NOT_TO_BE_LOGGED"


def test_environment_build(testio, monkeypatch):
    def mock_put_request(self, url, json=None, *args, **kwargs):
        put_requests.append(json["status"])
        return MockRequestReponse()

    def mock_delete_request(self, url, *args, **kwargs):
        proj_uuid, env_uuid = url.split("/")[-2:]
        delete_requests.append((proj_uuid, env_uuid))
        return MockRequestReponse()

    def mock_write_environment_dockerfile(*args, **kwargs):
        pass

    def mock_prepare_build_context(
        task_uuid, project_uuid, environment_uuid, project_path
    ):

        return {"snapshot_path": None, "base_image": None}

    def mock_cleanup_env_build_docker_artifacts(filters):
        docker_cleanup_uuid_request.append(filters["label"][1].split("=")[1])

    class MockAbortableAsyncResult:
        def __init__(self, task_uuid) -> None:
            pass

        def is_aborted(self):
            return testio["abort"]

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
            if not testio["image_in_local_environment"]:
                raise docker.errors.ImageNotFound("error")

        # Will be used as docker_client.api.build(...).
        def build(self, path, tag, *args, **kwargs):

            # The env build process should only log events/data between
            # the flags.
            events = (
                [_NOT_TO_BE_LOGGED]
                + ["_ORCHEST_RESERVED_FLAG_"]
                + testio["build_events"]
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

    # To keep track if requests are properly made.
    monkeypatch.setattr(requests.sessions.Session, "put", mock_put_request)
    monkeypatch.setattr(requests.sessions.Session, "delete", mock_delete_request)
    # Not much use to write the dockerfile since we are monkeypatching
    # docker.
    monkeypatch.setattr(
        app.core.environment_builds,
        "write_environment_dockerfile",
        mock_write_environment_dockerfile,
    )
    # Not much use to prepare the build context since we are
    # monkeypatching docker.
    monkeypatch.setattr(
        app.core.environment_builds, "prepare_build_context", mock_prepare_build_context
    )
    # Logs will be written here.
    monkeypatch.setattr(
        app.core.environment_builds,
        "__ENV_BUILD_FULL_LOGS_DIRECTORY",
        "/tmp/output_environment_build",
    )
    # To make sure the correct cleanup request is issued.
    monkeypatch.setattr(
        app.core.environment_builds,
        "cleanup_env_build_docker_artifacts",
        mock_cleanup_env_build_docker_artifacts,
    )
    # To be able to fake the cancellation of an env build.
    monkeypatch.setattr(
        app.core.environment_builds, "AbortableAsyncResult", MockAbortableAsyncResult
    )
    # To mock getting an image and building an image.
    monkeypatch.setattr(
        app.core.environment_builds, "docker_client", MockDockerClient()
    )
    # Capture build logs sent to socketio.
    monkeypatch.setattr(socketio, "Client", MockSocketIOClient)

    put_requests = []
    delete_requests = []
    docker_cleanup_uuid_request = []
    socketio_data = {
        "output_logs": [],
        "has_connected": False,
        "has_disconnected": False,
    }

    app.core.environment_builds.build_environment_task(
        testio["task_uuid"],
        testio["project_uuid"],
        testio["environment_uuid"],
        testio["project_path"],
    )

    assert len(put_requests) == 2
    assert put_requests[0] == "STARTED"

    if testio["abort"]:
        assert put_requests[1] == "ABORTED"
    elif any([event is None for event in testio["build_events"]]):
        assert put_requests[1] == "FAILURE"
    else:
        assert put_requests[1] == "SUCCESS"

    assert len(delete_requests) == 1
    assert delete_requests[0] == (testio["project_uuid"], testio["environment_uuid"])

    assert len(docker_cleanup_uuid_request) == 1
    assert docker_cleanup_uuid_request[0] == testio["project_uuid"]

    assert socketio_data["has_connected"]
    assert socketio_data["has_disconnected"]

    if not testio["abort"]:
        if not testio["image_in_local_environment"]:
            assert "Pulling image" in socketio_data["output_logs"][0]

        # We cannot rely on different messages being different elements
        # in the list, since the parent process will try to read
        # everything that is in the buffer every time, so multiple log
        # messages can be emitted togheter.
        logged_events = "".join(socketio_data["output_logs"])
        assert _NOT_TO_BE_LOGGED not in logged_events

        expected_events = []
        for event in testio["build_events"]:
            if event is None:
                break
            expected_events.append(event)
        expected_events = "\n".join(expected_events)
        assert expected_events in logged_events
