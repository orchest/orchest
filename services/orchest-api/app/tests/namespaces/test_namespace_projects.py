from _orchest.internals.test_utils import gen_uuid
from app.apis import namespace_jobs
from app.core.sessions import InteractiveSession


def test_projectlist_get_empty(client):
    data = client.get("/api/projects/").get_json()
    assert data == {"projects": []}


def test_projectlist_post(client):
    project = {"uuid": gen_uuid(), "env_variables": {"a": [1]}}

    client.post("/api/projects/", json=project)
    data = client.get("/api/projects/").get_json()["projects"][0]

    # env_variables is a deferred column, not returned by this endpoint.
    project["env_variables"] = None
    assert data == project


def test_projectlist_post_same_uuid(client):
    project = {"uuid": gen_uuid(), "env_variables": {"a": [1]}}
    resp1 = client.post("/api/projects/", json=project)
    resp2 = client.post("/api/projects/", json=project)

    assert resp1.status_code == 201
    assert resp2.status_code == 500


def test_projectlist_post_n(client):
    n = 5
    for _ in range(n):
        project = {"uuid": gen_uuid(), "env_variables": {"a": [1]}}
        client.post("/api/projects/", json=project)

    data = client.get("/api/projects/").get_json()["projects"]
    assert len(data) == n


def test_project_get(client):
    project = {"uuid": gen_uuid(), "env_variables": {"a": [1]}}

    client.post("/api/projects/", json=project)
    data = client.get(f'/api/projects/{project["uuid"]}').get_json()

    assert data == project


def test_project_get_non_existent(client):

    resp = client.get(f"/api/projects/{gen_uuid()}")
    assert resp.status_code == 404


def test_project_put(client):
    project = {"uuid": gen_uuid(), "env_variables": {"a": [1]}}

    client.post("/api/projects/", json=project)
    project["env_variables"] = {"b": {"x": 1}}
    client.put(f'/api/projects/{project["uuid"]}', json=project)

    data = client.get(f'/api/projects/{project["uuid"]}').get_json()
    assert data == project


def test_project_delete_non_existing(client):
    resp = client.delete(f"/api/projects/{gen_uuid()}")

    assert resp.status_code == 200


def test_project_delete_existing(client):
    project = {"uuid": gen_uuid()}
    client.post("/api/projects/", json=project)

    resp = client.delete(f'/api/projects/{project["uuid"]}')

    assert resp.status_code == 200


def test_delete_existing_with_interactive_run(
    client, celery, interactive_run, abortable_async_res
):

    resp = client.delete(f"/api/projects/{interactive_run.project.uuid}")
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
    resp = client.delete(f"/api/projects/{proj_uuid}")
    assert resp.status_code == 200
    assert not client.get("/api/sessions/").get_json()["sessions"]
    assert s.is_shutdown


def test_delete_existing_with_job(
    client, celery, job, abortable_async_res, monkeypatch
):
    monkeypatch.setattr(
        namespace_jobs, "lock_environment_images_for_job", lambda *args, **kwargs: {}
    )
    # client.put(f"/api/jobs/{job.uuid}", json={"confirm_draft": True})

    resp = client.delete(f"/api/projects/{job.project.uuid}")
    assert resp.status_code == 200
    # assert celery.revoked_tasks
    # assert abortable_async_res.aborted
    assert not client.get("/api/jobs/").get_json()["jobs"]
