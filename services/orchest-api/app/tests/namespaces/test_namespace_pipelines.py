from _orchest.internals.test_utils import gen_uuid
from app.core.sessions import InteractiveSession


def test_pipelinelist_get_empty(client):
    data = client.get("/api/pipelines/").get_json()
    assert data == {"pipelines": []}


def test_pipelinelist_post(client, project):
    pipeline = {
        "project_uuid": project.uuid,
        "uuid": gen_uuid(),
        "env_variables": {"a": "[1]"},
    }
    client.post("/api/pipelines/", json=pipeline)

    data = client.get("/api/pipelines/").get_json()["pipelines"][0]

    # env_variables is a deferred column, not returned by this endpoint.
    pipeline["env_variables"] = None
    assert data == pipeline


def test_pipelinelist_post_no_project(client):
    pipeline = {
        "project_uuid": gen_uuid(),
        "uuid": gen_uuid(),
        "env_variables": {"a": "[1]"},
    }
    resp = client.post("/api/pipelines/", json=pipeline)

    assert resp.status_code == 500


def test_pipelinelist_post_same_uuid(client, project):
    pipeline = {
        "project_uuid": project.uuid,
        "uuid": gen_uuid(),
        "env_variables": {"a": "[1]"},
    }

    resp1 = client.post("/api/pipelines/", json=pipeline)
    resp2 = client.post("/api/pipelines/", json=pipeline)

    assert resp1.status_code == 201
    assert resp2.status_code == 500


def test_pipelinelist_post_n(client, project):
    n = 5
    for _ in range(n):
        pipeline = {
            "project_uuid": project.uuid,
            "uuid": gen_uuid(),
            "env_variables": {"a": "[1]"},
        }
        client.post("/api/pipelines/", json=pipeline)

    data = client.get("/api/pipelines/").get_json()["pipelines"]
    assert len(data) == n


def test_pipeline_get(client, project):
    pipeline = {
        "project_uuid": project.uuid,
        "uuid": gen_uuid(),
        "env_variables": {"a": "[1]"},
    }
    client.post("/api/pipelines/", json=pipeline)

    data = client.get(f'/api/pipelines/{project.uuid}/{pipeline["uuid"]}').get_json()

    assert data == pipeline


def test_pipeline_get_non_existent(client):

    resp = client.get(f"/api/pipelines/{gen_uuid()}")
    assert resp.status_code == 404


def test_pipeline_put(client, project):
    pipeline = {
        "project_uuid": project.uuid,
        "uuid": gen_uuid(),
        "env_variables": {"a": "[1]"},
    }
    client.post("/api/pipelines/", json=pipeline)

    pipeline["env_variables"] = {"b": '{"x": ""}'}
    client.put(f'/api/pipelines/{project.uuid}/{pipeline["uuid"]}', json=pipeline)

    data = client.get(f'/api/pipelines/{project.uuid}/{pipeline["uuid"]}').get_json()
    assert data == pipeline


def test_pipeline_delete_non_existing(client):
    resp = client.delete(f"/api/pipelines/{gen_uuid()}/{gen_uuid()}")

    assert resp.status_code == 200


def test_delete_existing(client, project):
    pipeline = {
        "project_uuid": project.uuid,
        "uuid": gen_uuid(),
        "env_variables": {"a": "[1]"},
    }

    client.post("/api/pipelines/", json=pipeline)

    resp = client.delete(f'/api/pipelines/{project.uuid}/{pipeline["uuid"]}')

    assert resp.status_code == 200


def test_delete_existing_with_interactive_run(
    client, celery, interactive_run, abortable_async_res
):

    proj_uuid = interactive_run.project.uuid
    pipe_uuid = interactive_run.pipeline.uuid
    resp = client.delete(f"/api/pipelines/{proj_uuid}/{pipe_uuid}")
    assert resp.status_code == 200
    assert celery.revoked_tasks
    assert abortable_async_res.is_aborted()
    assert not client.get("/api/runs/").get_json()["runs"]


def test_delete_existing_with_interactive_session(
    client, interactive_session, monkeypatch
):
    class ShutDown:
        def __init__(self):
            self.is_shutdown = False

        def shutdown(self, *args, **kwargs):
            self.is_shutdown = True

    s = ShutDown()
    monkeypatch.setattr(
        InteractiveSession, "from_container_IDs", lambda *args, **kwargs: s
    )

    proj_uuid = interactive_session.project.uuid
    pipe_uuid = interactive_session.pipeline.uuid

    resp = client.delete(f"/api/pipelines/{proj_uuid}/{pipe_uuid}")
    assert resp.status_code == 200
    assert s.is_shutdown
    assert not client.get("/api/sessions/").get_json()["sessions"]
