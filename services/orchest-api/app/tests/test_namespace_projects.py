def test_empty_db(client):
    data = client.get("/api/projects/").get_json()
    assert data == {"projects": []}


def test_post(client, uuid4):
    project = {"uuid": uuid4(), "env_variables": {"a": [1]}}

    client.post("/api/projects/", json=project)
    data = client.get("/api/projects/").get_json()["projects"][0]

    # env_variables is a deferred column, not returned by this endpoint.
    project["env_variables"] = None
    assert data == project


def test_post_same_uuid(client, uuid4):
    project = {"uuid": uuid4(), "env_variables": {"a": [1]}}
    resp1 = client.post("/api/projects/", json=project)
    resp2 = client.post("/api/projects/", json=project)

    assert resp1.status_code == 201
    assert resp2.status_code == 500


def test_post_n(client, uuid4):
    n = 5
    for _ in range(n):
        project = {"uuid": uuid4(), "env_variables": {"a": [1]}}
        client.post("/api/projects/", json=project)

    data = client.get("/api/projects/").get_json()["projects"]
    assert len(data) == n


def test_get(client, uuid4):
    project = {"uuid": uuid4(), "env_variables": {"a": [1]}}

    client.post("/api/projects/", json=project)
    data = client.get(f'/api/projects/{project["uuid"]}').get_json()

    assert data == project


def test_get_non_existent(client, uuid4):

    resp = client.get(f"/api/projects/{uuid4()}")
    assert resp.status_code == 404


def test_put(client, uuid4):
    project = {"uuid": uuid4(), "env_variables": {"a": [1]}}

    client.post("/api/projects/", json=project)
    project["env_variables"] = {"b": {"x": 1}}
    client.put(f'/api/projects/{project["uuid"]}', json=project)

    data = client.get(f'/api/projects/{project["uuid"]}').get_json()
    assert data == project


def test_delete_non_existing(client, uuid4):
    resp = client.delete(f"/api/projects/{uuid4()}")

    assert resp.status_code == 200


def test_delete_existing(client, uuid4):
    project = {"uuid": uuid4()}
    client.post("/api/projects/", json=project)

    resp = client.delete(f'/api/projects/{project["uuid"]}')

    assert resp.status_code == 200
