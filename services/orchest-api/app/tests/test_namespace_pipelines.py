def test_empty_db(client):
    data = client.get("/api/pipelines/").get_json()
    assert data == {"pipelines": []}


def test_post(client, uuid4, project):
    pipeline = {
        "project_uuid": project.uuid,
        "uuid": uuid4(),
        "env_variables": {"a": [1]},
    }
    client.post("/api/pipelines/", json=pipeline)

    data = client.get("/api/pipelines/").get_json()["pipelines"][0]

    # env_variables is a deferred column, not returned by this endpoint.
    pipeline["env_variables"] = None
    assert data == pipeline


def test_post_no_project(client, uuid4):
    pipeline = {"project_uuid": uuid4(), "uuid": uuid4(), "env_variables": {"a": [1]}}
    resp = client.post("/api/pipelines/", json=pipeline)

    assert resp.status_code == 500


def test_post_same_uuid(client, uuid4, project):
    pipeline = {
        "project_uuid": project.uuid,
        "uuid": uuid4(),
        "env_variables": {"a": [1]},
    }

    resp1 = client.post("/api/pipelines/", json=pipeline)
    resp2 = client.post("/api/pipelines/", json=pipeline)

    assert resp1.status_code == 201
    assert resp2.status_code == 500


def test_post_n(client, uuid4, project):
    n = 5
    for _ in range(n):
        pipeline = {
            "project_uuid": project.uuid,
            "uuid": uuid4(),
            "env_variables": {"a": [1]},
        }
        client.post("/api/pipelines/", json=pipeline)

    data = client.get("/api/pipelines/").get_json()["pipelines"]
    assert len(data) == n


def test_get(client, uuid4, project):
    pipeline = {
        "project_uuid": project.uuid,
        "uuid": uuid4(),
        "env_variables": {"a": [1]},
    }
    client.post("/api/pipelines/", json=pipeline)

    data = client.get(f'/api/pipelines/{project.uuid}/{pipeline["uuid"]}').get_json()

    assert data == pipeline


def test_get_non_existent(client, uuid4):

    resp = client.get(f"/api/pipelines/{uuid4()}")
    assert resp.status_code == 404


def test_put(client, uuid4, project):
    pipeline = {
        "project_uuid": project.uuid,
        "uuid": uuid4(),
        "env_variables": {"a": [1]},
    }
    client.post("/api/pipelines/", json=pipeline)

    pipeline["env_variables"] = {"b": {"x": 1}}
    client.put(f'/api/pipelines/{project.uuid}/{pipeline["uuid"]}', json=pipeline)

    data = client.get(f'/api/pipelines/{project.uuid}/{pipeline["uuid"]}').get_json()
    assert data == pipeline


def test_delete_non_existing(client, uuid4):
    resp = client.delete(f"/api/pipelines/{uuid4()}/{uuid4()}")

    assert resp.status_code == 200


def test_delete_existing(client, uuid4, project):
    pipeline = {
        "project_uuid": project.uuid,
        "uuid": uuid4(),
        "env_variables": {"a": [1]},
    }

    client.post("/api/pipelines/", json=pipeline)

    resp = client.delete(f'/api/pipelines/{project.uuid}/{pipeline["uuid"]}')

    assert resp.status_code == 200
