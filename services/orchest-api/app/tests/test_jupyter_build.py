import os

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
import app.core.jupyter_builds
from _orchest.internals import config as _config

# String that should not appear in the logs.
_NOT_TO_BE_LOGGED = "_NOT_TO_BE_LOGGED"


@pytest.fixture(scope="module")
def patch_environ_orchest_version():
    old_orchest_version = os.environ.get("ORCHEST_VERSION")
    os.environ.update({"ORCHEST_VERSION": "FAKE_VERSION_TEST"})
    yield
    os.environ.update({"ORCHEST_VERSION": old_orchest_version})


@pytest.mark.parametrize(
    "abort",
    [True, False],
    ids=["abort_task", "do_not_abort_task"],
)
def test_jupyter_build(abort, monkeypatch):
    def mock_cleanup_docker_artifacts(filters):
        pass

    def mock_put_request(self, url, json=None, *args, **kwargs):
        put_requests.append(json["status"])
        return MockRequestReponse()

    def mock_delete_request(self, url, *args, **kwargs):
        return MockRequestReponse()

    def mock_prepare_build_context(task_uuid):
        return {"snapshot_path": None, "base_image": None}

    # To keep track if requests are properly made.
    monkeypatch.setattr(requests.sessions.Session, "put", mock_put_request)
    monkeypatch.setattr(requests.sessions.Session, "delete", mock_delete_request)

    # Not much use to prepare the build context since we are
    # monkeypatching docker.
    monkeypatch.setattr(
        app.core.jupyter_builds, "prepare_build_context", mock_prepare_build_context
    )

    # Logs will be written here.
    monkeypatch.setattr(
        app.core.jupyter_builds,
        "__JUPYTER_BUILD_FULL_LOGS_DIRECTORY",
        "/tmp/output_jupyter_build",
    )

    # To make sure the correct cleanup request is issued.
    monkeypatch.setattr(
        app.core.jupyter_builds,
        "cleanup_docker_artifacts",
        mock_cleanup_docker_artifacts,
    )

    # To be able to fake the cancellation of a Jupyter build.
    monkeypatch.setattr(
        app.core.jupyter_builds,
        "AbortableAsyncResult",
        mocked_abortable_async_result(abort),
    )

    # To mock getting an image and building an image.
    MockedDockerClient = mocked_docker_client(_NOT_TO_BE_LOGGED, [])
    monkeypatch.setattr(app.core.image_utils, "docker_client", MockedDockerClient())

    socketio_data = {
        "output_logs": [],
        "has_connected": False,
        "has_disconnected": False,
    }

    # Capture build logs sent to socketio.
    monkeypatch.setattr(socketio, "Client", mocked_socketio_class(socketio_data))

    # Inputs of the function to be tested.
    task_uuid = "task_uuid"

    put_requests = []
    app.core.jupyter_builds.build_jupyter_task(
        task_uuid,
    )

    assert len(put_requests) == 2
    assert put_requests[0] == "STARTED"

    if abort:
        assert put_requests[1] == "ABORTED"
    else:
        assert put_requests[1] == "SUCCESS"

    assert socketio_data["has_connected"]
    assert socketio_data["has_disconnected"]

    # Successful tests can remove their log file.
    os.remove(
        os.path.join(
            app.core.jupyter_builds.__JUPYTER_BUILD_FULL_LOGS_DIRECTORY,
            _config.JUPYTER_IMAGE_NAME,
        )
    )
