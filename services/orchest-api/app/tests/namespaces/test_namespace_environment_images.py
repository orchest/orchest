from tests.test_utils import create_env_build_request


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


def test_environmentimageinuse_get(client):
    resp = client.get("/api/environment-images/in-use/proj_uuid/env_uuid")
    data = resp.get_json()
    assert resp.status_code == 200
    assert not data["in_use"]


def test_projectenvironmentdanglingimages_delete(client):
    resp = client.delete("/api/environment-images/dangling/proj_uuid/env_uuid")
    assert resp.status_code == 200
