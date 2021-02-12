import datetime

import pytest
from tests.test_utils import create_pipeline_run_spec

from app.apis import namespace_runs


@pytest.mark.parametrize(
    "query_string",
    [{}, {"project_uuid": "proj"}, {"project_uuid": "proj", "pipeline_uuid": "pipe"}],
    ids=["no-filter", "project", "project_pipeline"],
)
def test_runlist_get_empty(client, query_string):
    resp = client.get("/api/runs/", query_string=query_string)
    assert resp.status_code == 200
    assert not resp.get_json()["runs"]


def test_runlist_post_success(
    client, celery, pipeline, monkeypatch_lock_environment_images
):

    resp = client.post(
        "/api/runs/",
        json=create_pipeline_run_spec(pipeline.project.uuid, pipeline.uuid),
    )
    data = resp.get_json()
    assert resp.status_code == 201
    assert data["status"] == "PENDING"
    assert data["project_uuid"] == pipeline.project.uuid
    assert data["pipeline_uuid"] == pipeline.uuid


def test_runlist_post_success_env_vars(
    client, celery, pipeline, monkeypatch_lock_environment_images
):
    # Prepare proj/pipeline env variables.
    proj_env_vars = {"var1": 1, "var2": 2}
    client.put(
        f"/api/projects/{pipeline.project.uuid}", json={"env_variables": proj_env_vars}
    )

    pipe_env_vars = {"var2": "overwritten", "var3": 3}
    client.put(
        f"/api/pipelines/{pipeline.project.uuid}/{pipeline.uuid}",
        json={"env_variables": pipe_env_vars},
    )

    client.post(
        "/api/runs/",
        json=create_pipeline_run_spec(pipeline.project.uuid, pipeline.uuid),
    )
    env_vars = celery.tasks[0][1]["kwargs"]["run_config"]["user_env_variables"]
    assert env_vars == {**proj_env_vars, **pipe_env_vars}


def test_runlist_post_revert(client, celery, pipeline, monkeypatch):
    monkeypatch.setattr(
        namespace_runs, "lock_environment_images_for_run", lambda *args, **kwargs: 1 / 0
    )

    resp = client.post(
        "/api/runs/",
        json=create_pipeline_run_spec(pipeline.project.uuid, pipeline.uuid),
    )
    assert resp.status_code == 500

    data = client.get("/api/runs/").get_json()["runs"]
    assert data[0]["status"] == "FAILURE"


def test_runlist_get(client, celery, pipeline, monkeypatch_lock_environment_images):
    client.post(
        "/api/runs/",
        json=create_pipeline_run_spec(pipeline.project.uuid, pipeline.uuid),
    )
    client.post(
        "/api/runs/",
        json=create_pipeline_run_spec(pipeline.project.uuid, pipeline.uuid),
    )

    for query_string, expected_length in [
        ({}, 2),
        ({"project_uuid": pipeline.project.uuid}, 2),
        ({"project_uuid": "proj"}, 0),
        ({"project_uuid": pipeline.project.uuid, "pipeline_uuid": "pipe"}, 0),
    ]:
        resp = client.get("/api/runs/", query_string=query_string)
        assert len(resp.get_json()["runs"]) == expected_length


def test_run_delete_not_existing(client):
    resp = client.delete("/api/runs/run_uuid")
    assert resp.status_code == 400


def test_run_delete_started(
    client, celery, pipeline, abortable_async_res, monkeypatch_lock_environment_images
):
    resp = client.post(
        "/api/runs/",
        json=create_pipeline_run_spec(pipeline.project.uuid, pipeline.uuid),
    )
    run_uuid = resp.get_json()["uuid"]
    resp = client.delete(f"/api/runs/{run_uuid}")
    assert celery.revoked_tasks
    assert abortable_async_res.is_aborted()


def test_run_delete_after_end_state(
    client, celery, pipeline, abortable_async_res, monkeypatch_lock_environment_images
):
    resp = client.post(
        "/api/runs/",
        json=create_pipeline_run_spec(pipeline.project.uuid, pipeline.uuid),
    )
    run_uuid = resp.get_json()["uuid"]
    client.put(
        f"/api/runs/{run_uuid}",
        json={
            "status": "SUCCESS",
            "finished_time": datetime.datetime.now().isoformat(),
        },
    )

    resp = client.delete(f"/api/runs/{run_uuid}")
    assert resp.status_code == 400
    assert not celery.revoked_tasks
    assert not abortable_async_res.is_aborted()
