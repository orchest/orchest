from tests.test_utils import create_env_build_request

from app.apis import namespace_environment_images


def test_environmentimage_delete_non_existent(client):
    resp = client.delete("/api/environment-images/proj_uuid/env_uuid")
    assert resp.status_code == 200


def test_environmentimage_delete_with_builds(
    client, celery, project, abortable_async_res
):

    req = create_env_build_request(project.uuid, 1)
    env_uuid = req["environment_build_requests"][0]["environment_uuid"]
    client.post("/api/environment-builds/", json=req)

    resp = client.delete(f"/api/environment-images/{project.uuid}/{env_uuid}")
    assert resp.status_code == 200
    assert abortable_async_res.is_aborted()
    assert celery.revoked_tasks
    assert not client.get("/api/environment-builds/").get_json()["environment_builds"]


def test_environmentimage_delete_with_session(client, interactive_session, monkeypatch):
    monkeypatch.setattr(
        namespace_environment_images,
        "interactive_sessions_using_environment",
        lambda *args, **kwargs: [interactive_session],
    )

    sess = interactive_session
    resp = client.delete(f"/api/environment-images/{sess.project_uuid}/1234")

    assert resp.status_code == 200
    assert not client.get("/api/sessions/").get_json()["sessions"]


def test_environmentimage_delete_with_job(
    client, celery, job, monkeypatch, abortable_async_res
):
    monkeypatch.setattr(
        namespace_environment_images,
        "jobs_using_environment",
        lambda *args, **kwargs: [job],
    )

    resp = client.delete(f"/api/environment-images/{job.project.uuid}/1234")

    assert resp.status_code == 200
    assert client.get("/api/jobs/").get_json()["jobs"][0]["status"] == "ABORTED"


def test_environmentimage_delete_with_interactive_run(
    client, celery, interactive_run, monkeypatch, abortable_async_res
):
    monkeypatch.setattr(
        namespace_environment_images,
        "interactive_runs_using_environment",
        lambda *args, **kwargs: [interactive_run],
    )

    resp = client.delete(f"/api/environment-images/{interactive_run.project.uuid}/1234")

    assert resp.status_code == 200
    assert client.get("/api/runs/").get_json()["runs"][0]["status"] == "ABORTED"


def test_environmentimageinuse_get(client):
    resp = client.get("/api/environment-images/in-use/proj_uuid/env_uuid")
    data = resp.get_json()
    assert resp.status_code == 200
    assert not data["in_use"]


def test_projectenvironmentdanglingimages_delete(client):
    resp = client.delete("/api/environment-images/dangling/proj_uuid/env_uuid")
    assert resp.status_code == 200
