from tests.test_utils import create_env_build_request

from _orchest.internals.test_utils import CeleryMock, gen_uuid, raise_exception_function
from app.apis import namespace_environment_builds


def test_environmentbuildlist_get_empty(client):
    data = client.get("/api/environment-builds/").get_json()
    assert data == {"environment_builds": []}


def test_environmentbuildlist_post(client, celery, project, monkeypatch):
    req = create_env_build_request(project.uuid, 1)
    data = client.post("/api/environment-builds/", json=req).get_json()

    assert data["failed_requests"] is None

    env = req["environment_build_requests"][0]
    env["status"] = "PENDING"
    env["started_time"] = None
    env["finished_time"] = None

    env_build = data["environment_builds"][0]
    for k, v in env.items():
        assert v == env_build[k]


def test_environmentbuildlist_post_same(client, celery, project):
    env = {
        "project_uuid": project.uuid,
        "project_path": "project_path",
        "environment_uuid": gen_uuid(),
    }
    req = {"environment_build_requests": [env, env]}
    data = client.post("/api/environment-builds/", json=req).get_json()
    assert len(data["environment_builds"]) == 1
    assert data["failed_requests"] is None


def test_environmentbuildlist_post_with_error1(client, project, monkeypatch):
    monkeypatch.setattr(
        namespace_environment_builds, "make_celery", raise_exception_function()
    )

    data = client.post(
        "/api/environment-builds/", json=create_env_build_request(project.uuid, 1)
    ).get_json()
    assert len(data["failed_requests"]) == 1


def test_environmentbuildlist_post_with_error2(client, project, monkeypatch):
    celery = CeleryMock()
    # Make it so that only the first request will go through.
    monkeypatch.setattr(
        namespace_environment_builds,
        "make_celery",
        raise_exception_function(
            should_trigger=lambda: bool(celery.tasks), return_value=celery
        ),
    )

    data = client.post(
        "/api/environment-builds/", json=create_env_build_request(project.uuid, 3)
    ).get_json()
    assert len(data["environment_builds"]) == 3
    assert len(data["failed_requests"]) == 2


def test_environmentbuildlist_get(client, celery, project):
    client.post(
        "/api/environment-builds/", json=create_env_build_request(project.uuid, 1)
    )

    data = client.get("/api/environment-builds/").get_json()
    assert len(data["environment_builds"]) == 1


def test_environmentbuildlist_post_revert(client, project, monkeypatch):
    monkeypatch.setattr(
        namespace_environment_builds, "make_celery", raise_exception_function()
    )
    client.post(
        "/api/environment-builds/", json=create_env_build_request(project.uuid, 1)
    )

    data = client.get("/api/environment-builds/").get_json()
    data = data["environment_builds"][0]
    assert data["status"] == "FAILURE"


def test_environmentbuild_get_empty(client):
    resp = client.get("/api/environment-builds/build_uuid")
    assert resp.status_code == 404


def test_environmentbuild_delete(client, celery, project, abortable_async_res):

    data = client.post(
        "/api/environment-builds/", json=create_env_build_request(project.uuid, 1)
    ).get_json()
    data = data["environment_builds"][0]
    assert data["status"] == "PENDING"

    env_build_uuid = data["uuid"]
    resp = client.delete(f"/api/environment-builds/{env_build_uuid}")

    assert resp.status_code == 200
    assert abortable_async_res.is_aborted()
    assert celery.revoked_tasks


def test_projectenvironmostrecentbuild_get_empty(client):
    data = client.get(
        "/api/environment-builds/most-recent/proj_uuid/env_uuid"
    ).get_json()
    assert data == {"environment_builds": []}


def test_projectenvironmentmostrecentbuild_get(
    client, celery, project, abortable_async_res
):
    req = create_env_build_request(project.uuid, 1)
    for _ in range(5):
        last_uuid = client.post("/api/environment-builds/", json=req).get_json()[
            "environment_builds"
        ][0]["uuid"]

    env_uuid = req["environment_build_requests"][0]["environment_uuid"]
    data = client.get(
        f"/api/environment-builds/most-recent/{project.uuid}/{env_uuid}"
    ).get_json()
    assert data["environment_builds"][0]["uuid"] == last_uuid


def test_projectmostrecentbuildlist_get_empty(client):
    data = client.get("/api/environment-builds/most-recent/proj_uuid").get_json()
    assert data == {"environment_builds": []}


def test_projectmostrecentbuildlist_get(client, celery, project, abortable_async_res):
    req = create_env_build_request(project.uuid, 2)
    for _ in range(5):
        data = client.post("/api/environment-builds/", json=req).get_json()[
            "environment_builds"
        ]

    possible_uuids = [data[0]["uuid"], data[1]["uuid"]]

    data = client.get(f"/api/environment-builds/most-recent/{project.uuid}").get_json()[
        "environment_builds"
    ]
    assert len(data) == 2
    assert data[0]["uuid"] in possible_uuids
    assert data[1]["uuid"] in possible_uuids
