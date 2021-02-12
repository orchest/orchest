import docker

from app.apis import namespace_validations as ns_val


def test_gate_post_success(client, monkeypatch):
    class DockerClient:
        def __init__(self):
            self.images = self

        def get(*args, **kwargs):
            return []

    monkeypatch.setattr(ns_val, "docker_client", DockerClient())
    req = {"project_uuid": "1", "environment_uuids": ["1", "2"]}

    resp = client.post("/api/validations/environments", json=req)
    data = resp.get_json()
    assert resp.status_code == 201
    assert data["validation"] == "pass"
    assert data["pass"] == ["1", "2"]


def test_gate_post_api_error(client, monkeypatch):
    class DockerClient:
        def __init__(self):
            self.images = self

        def get(*args, **kwargs):
            raise docker.errors.APIError("")

    monkeypatch.setattr(ns_val, "docker_client", DockerClient())
    req = {"project_uuid": "1", "environment_uuids": ["1", "2"]}

    resp = client.post("/api/validations/environments", json=req)
    data = resp.get_json()
    assert resp.status_code == 201
    assert data["validation"] == "fail"
    assert data["fail"] == ["1", "2"]
    assert data["actions"] == ["RETRY", "RETRY"]


def test_gate_post_image_not_found_wait(client, environment_build, monkeypatch):
    class DockerClient:
        def __init__(self):
            self.images = self

        def get(*args, **kwargs):
            raise docker.errors.ImageNotFound("")

    monkeypatch.setattr(ns_val, "docker_client", DockerClient())
    req = {
        "project_uuid": environment_build.project.uuid,
        "environment_uuids": [environment_build.environment_uuid],
    }

    resp = client.post("/api/validations/environments", json=req)
    data = resp.get_json()
    assert resp.status_code == 201
    assert data["validation"] == "fail"
    assert data["fail"] == [environment_build.environment_uuid]
    assert data["actions"] == ["WAIT"]


def test_gate_post_image_not_found_build(client, monkeypatch):
    class DockerClient:
        def __init__(self):
            self.images = self

        def get(*args, **kwargs):
            raise docker.errors.ImageNotFound("")

    monkeypatch.setattr(ns_val, "docker_client", DockerClient())
    req = {"project_uuid": "1", "environment_uuids": ["1"]}

    resp = client.post("/api/validations/environments", json=req)
    data = resp.get_json()
    assert resp.status_code == 201
    assert data["validation"] == "fail"
    assert data["fail"] == ["1"]
    assert data["actions"] == ["BUILD"]
