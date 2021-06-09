from _orchest.internals.test_utils import raise_exception_function
from app.apis.namespace_sessions import (
    AbortPipelineRun,
    CreateInteractiveSession,
    RestartMemoryServer,
    StopInteractiveSession,
)
from app.core.sessions import InteractiveSession


def test_sessionlist_get_empty(client):
    data = client.get("/api/sessions/").get_json()
    assert data == {"sessions": []}


def test_sessionlist_post_is_launching(client, pipeline, monkeypatch):
    pipeline_spec = {
        "project_uuid": pipeline.project.uuid,
        "pipeline_uuid": pipeline.uuid,
        "pipeline_path": "pip_path",
        "project_dir": "project_dir",
        "host_userdir": "host_userdir",
    }

    monkeypatch.setattr(
        CreateInteractiveSession, "_collateral", lambda *args, **kwargs: None
    )

    client.post("/api/sessions/", json=pipeline_spec)
    data = client.get("/api/sessions/").get_json()["sessions"][0]

    expected = {
        "project_uuid": pipeline.project.uuid,
        "pipeline_uuid": pipeline.uuid,
        "status": "LAUNCHING",
        "jupyter_server_ip": None,
        "notebook_server_info": {"port": 8888, "base_url": "/"},
        "user_services": {},
    }

    assert data == expected


def test_sessionlist_post_is_running(client, pipeline, monkeypatch_interactive_session):
    pipeline_spec = {
        "project_uuid": pipeline.project.uuid,
        "pipeline_uuid": pipeline.uuid,
        "pipeline_path": "pip_path",
        "project_dir": "project_dir",
        "host_userdir": "host_userdir",
    }

    client.post("/api/sessions/", json=pipeline_spec)
    data = client.get(
        f"/api/sessions/{pipeline.project.uuid}/{pipeline.uuid}"
    ).get_json()

    assert data["status"] == "RUNNING"


def test_sessionlist_post_revert(client, pipeline, monkeypatch):
    pipeline_spec = {
        "project_uuid": pipeline.project.uuid,
        "pipeline_uuid": pipeline.uuid,
        "pipeline_path": "pip_path",
        "project_dir": "project_dir",
        "host_userdir": "host_userdir",
    }

    monkeypatch.setattr(InteractiveSession, "launch", raise_exception_function)
    client.post("/api/sessions/", json=pipeline_spec)

    resp = client.get(f"/api/sessions/{pipeline.project.uuid}/{pipeline.uuid}")

    assert resp.status_code == 404


def test_session_put(client, pipeline, monkeypatch_interactive_session, monkeypatch):
    pipeline_spec = {
        "project_uuid": pipeline.project.uuid,
        "pipeline_uuid": pipeline.uuid,
        "pipeline_path": "pip_path",
        "project_dir": "project_dir",
        "host_userdir": "host_userdir",
    }

    class Restarted:
        def __init__(self):
            self.restarted = False

        def restart_resource(self, *args, **kwargs):
            self.restarted = True

    r = Restarted()

    monkeypatch.setattr(
        InteractiveSession, "from_container_IDs", lambda *args, **kwargs: r
    )
    client.post("/api/sessions/", json=pipeline_spec)

    resp = client.put(f"/api/sessions/{pipeline.project.uuid}/{pipeline.uuid}")
    assert resp.status_code == 200
    assert r.restarted


def test_session_put_aborts_interactive_run(
    client, interactive_run, monkeypatch_interactive_session, monkeypatch
):
    pr_uuid = interactive_run.project.uuid
    pl_uuid = interactive_run.pipeline.uuid
    pipeline_spec = {
        "project_uuid": pr_uuid,
        "pipeline_uuid": pl_uuid,
        "pipeline_path": "pip_path",
        "project_dir": "project_dir",
        "host_userdir": "host_userdir",
    }

    client.post("/api/sessions/", json=pipeline_spec)

    monkeypatch.setattr(
        RestartMemoryServer, "_collateral", lambda *args, **kwargs: None
    )
    monkeypatch.setattr(AbortPipelineRun, "_collateral", lambda *args, **kwargs: None)
    resp = client.put(f"/api/sessions/{pr_uuid}/{pl_uuid}")
    assert resp.status_code == 200

    query = {"project_uuid": pr_uuid, "pipeline_uuid": pl_uuid}
    data = client.get("/api/runs/", query_string=query).get_json()
    assert data["runs"][0]["status"] == "ABORTED"


def test_session_put_non_existent(client):
    resp = client.put("/api/sessions/hello/world")
    assert resp.status_code == 500


def test_session_delete_is_stopping(
    client, pipeline, monkeypatch_interactive_session, monkeypatch
):
    pipeline_spec = {
        "project_uuid": pipeline.project.uuid,
        "pipeline_uuid": pipeline.uuid,
        "pipeline_path": "pip_path",
        "project_dir": "project_dir",
        "host_userdir": "host_userdir",
    }

    client.post("/api/sessions/", json=pipeline_spec)

    monkeypatch.setattr(
        StopInteractiveSession, "_collateral", lambda *args, **kwargs: None
    )
    resp = client.delete(f"/api/sessions/{pipeline.project.uuid}/{pipeline.uuid}")

    data = client.get(
        f"/api/sessions/{pipeline.project.uuid}/{pipeline.uuid}"
    ).get_json()

    assert resp.status_code == 200
    assert data["status"] == "STOPPING"


def test_session_delete_aborts_interactive_run(
    client, interactive_run, monkeypatch_interactive_session, monkeypatch
):
    pr_uuid = interactive_run.project.uuid
    pl_uuid = interactive_run.pipeline.uuid
    pipeline_spec = {
        "project_uuid": pr_uuid,
        "pipeline_uuid": pl_uuid,
        "pipeline_path": "pip_path",
        "project_dir": "project_dir",
        "host_userdir": "host_userdir",
    }

    client.post("/api/sessions/", json=pipeline_spec)

    monkeypatch.setattr(
        StopInteractiveSession, "_collateral", lambda *args, **kwargs: None
    )
    monkeypatch.setattr(AbortPipelineRun, "_collateral", lambda *args, **kwargs: None)
    resp = client.delete(f"/api/sessions/{pr_uuid}/{pl_uuid}")
    assert resp.status_code == 200

    query = {"project_uuid": pr_uuid, "pipeline_uuid": pl_uuid}
    data = client.get("/api/runs/", query_string=query).get_json()
    assert data["runs"][0]["status"] == "ABORTED"


def test_session_delete(client, pipeline, monkeypatch_interactive_session, monkeypatch):
    pipeline_spec = {
        "project_uuid": pipeline.project.uuid,
        "pipeline_uuid": pipeline.uuid,
        "pipeline_path": "pip_path",
        "project_dir": "project_dir",
        "host_userdir": "host_userdir",
    }

    class ShutDown:
        def __init__(self):
            self.is_shutdown = False

        def shutdown(self, *args, **kwargs):
            self.is_shutdown = True

    s = ShutDown()

    monkeypatch.setattr(
        InteractiveSession, "from_container_IDs", lambda *args, **kwargs: s
    )
    client.post("/api/sessions/", json=pipeline_spec)

    resp1 = client.delete(f"/api/sessions/{pipeline.project.uuid}/{pipeline.uuid}")

    resp2 = client.get(f"/api/sessions/{pipeline.project.uuid}/{pipeline.uuid}")

    assert resp1.status_code == 200
    assert resp2.status_code == 404
    assert s.is_shutdown


def test_session_delete_revert(
    client, pipeline, monkeypatch_interactive_session, monkeypatch
):
    pipeline_spec = {
        "project_uuid": pipeline.project.uuid,
        "pipeline_uuid": pipeline.uuid,
        "pipeline_path": "pip_path",
        "project_dir": "project_dir",
        "host_userdir": "host_userdir",
    }

    client.post("/api/sessions/", json=pipeline_spec)

    monkeypatch.setattr(
        InteractiveSession, "from_container_IDs", raise_exception_function()
    )
    resp1 = client.delete(f"/api/sessions/{pipeline.project.uuid}/{pipeline.uuid}")

    resp2 = client.get(f"/api/sessions/{pipeline.project.uuid}/{pipeline.uuid}")

    assert resp1.status_code == 200
    assert resp2.status_code == 404
