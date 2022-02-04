import os

import docker
import pytest
import requests
import socketio
from tests.test_utils import (
    MockRequestReponse,
    mocked_abortable_async_result,
    mocked_docker_client,
    mocked_socketio_class,
)

import app.connections
import app.core.environment_builds
from _orchest.internals.test_utils import raise_exception_function

# String that should not appear in the logs.
_NOT_TO_BE_LOGGED = "_NOT_TO_BE_LOGGED"


@pytest.mark.parametrize(
    "image_in_local_environment",
    [True, False],
    ids=["image_in_env", "image_not_in_env"],
)
@pytest.mark.parametrize(
    "abort",
    [True, False],
    ids=["abort_task", "do_not_abort_task"],
)
@pytest.mark.parametrize(
    "build_events",
    [[], [None], ["1", "2", "3", "4"], ["1", "2", "3", "4", None]],
    ids=["[]", "[None]", "[1, 2, 3, 4]", "[1, 2, 3, 4, None]"],
)
def test_environment_build(
    image_in_local_environment,
    abort,
    build_events,
    monkeypatch,
):
    def mock_cleanup_docker_artifacts(filters):
        docker_cleanup_uuid_request.add(filters["label"][-1].split("=")[1])

    def mock_put_request(self, url, json=None, *args, **kwargs):
        put_requests.append(json["status"])
        # We need to mock fork and kill because the cleanup function is
        # actually called by a forked process. This hack allows us to
        # verify what docker cleanup attempts are made without
        # interfering with the SioStreamedTask code which makes use of
        # fork and kill. This is because these states tell us that the
        # SioStreamedTask is actually done.
        if json["status"] in ["ABORTED", "SUCCESS", "FAILURE"]:
            monkeypatch.setattr(os, "fork", lambda: 0)
            monkeypatch.setattr(os, "kill", lambda *args, **kwargs: True)
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
        "cleanup_docker_artifacts",
        mock_cleanup_docker_artifacts,
    )
    # To be able to fake the cancellation of an env build.
    monkeypatch.setattr(
        app.core.environment_builds,
        "AbortableAsyncResult",
        mocked_abortable_async_result(abort),
    )
    # To mock getting an image and building an image.
    MockedDockerClient = mocked_docker_client(_NOT_TO_BE_LOGGED, build_events)

    # Patch docker get
    if not image_in_local_environment:
        monkeypatch.setattr(
            MockedDockerClient,
            "get",
            raise_exception_function(docker.errors.ImageNotFound("error")),
        )

    monkeypatch.setattr(app.core.image_utils, "docker_client", MockedDockerClient())

    socketio_data = {
        "output_logs": [],
        "has_connected": False,
        "has_disconnected": False,
    }

    # Capture build logs sent to socketio.
    monkeypatch.setattr(socketio, "Client", mocked_socketio_class(socketio_data))

    put_requests = []
    delete_requests = []
    docker_cleanup_uuid_request = set()

    # Inputs of the function to be tested.
    task_uuid = "task_uuid"
    # This way the name of the log file can easily be matched with the
    # actual test.
    project_uuid = "".join(
        [
            "events:",
            str(build_events),
            "-abort:",
            str(abort),
            "-image_in_local_environment:",
            str(image_in_local_environment),
        ]
    )
    environment_uuid = "environment_uuid"
    project_path = "project_path"

    app.core.environment_builds.build_environment_task(
        task_uuid,
        project_uuid,
        environment_uuid,
        project_path,
    )

    assert len(put_requests) == 2
    assert put_requests[0] == "STARTED"

    if abort:
        assert put_requests[1] == "ABORTED"
    elif any([event is None for event in build_events]):
        assert put_requests[1] == "FAILURE"
    else:
        assert put_requests[1] == "SUCCESS"

    assert len(delete_requests) == 1
    assert delete_requests[0] == (project_uuid, environment_uuid)

    assert len(docker_cleanup_uuid_request) == 1
    assert task_uuid in docker_cleanup_uuid_request

    assert socketio_data["has_connected"]
    assert socketio_data["has_disconnected"]

    if not abort:
        if not image_in_local_environment:
            assert "Pulling image" in socketio_data["output_logs"][0]

        # We cannot rely on different messages being different elements
        # in the list, since the parent process will try to read
        # everything that is in the buffer every time, so multiple log
        # messages can be emitted togheter.
        logged_events = "".join(socketio_data["output_logs"])
        assert _NOT_TO_BE_LOGGED not in logged_events

        expected_events = []
        for event in build_events:
            if event is None:
                break
            expected_events.append(event)
        expected_events = "\n".join(expected_events)
        assert expected_events in logged_events

    # Successful tests can remove their log file.
    os.remove(
        os.path.join(
            app.core.environment_builds.__ENV_BUILD_FULL_LOGS_DIRECTORY,
            f"orchest-env-{project_uuid}-{environment_uuid}",
        )
    )
