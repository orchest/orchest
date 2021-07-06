import datetime

import pytest
from tests.test_utils import create_job_spec

from _orchest.internals.test_utils import raise_exception_function
from app.apis import namespace_jobs


@pytest.mark.parametrize(
    "query_string", [{}, {"project_uuid": "proj"}], ids=["no-filter", "project"]
)
def test_joblist_get_empty(client, query_string):
    resp = client.get("/api/jobs/", query_string=query_string)
    assert resp.status_code == 200
    assert not resp.get_json()["jobs"]


@pytest.mark.parametrize(
    "proj_env_variables",
    [{}, {"var1": "project-value", "var2": 10}],
    ids=["no-proj-variables", "proj-variables"],
)
@pytest.mark.parametrize(
    "pipe_env_variables",
    [{}, {"var1": "pipeline-value", "var3": [1]}],
    ids=["no-pipe-variables", "pipe-variables"],
)
@pytest.mark.parametrize(
    "cron_schedule",
    [None, "* * * * *", "invalid string"],
    ids=["no-cron-string", "valid-cron-string", "invalid-cron-string"],
)
@pytest.mark.parametrize(
    "scheduled_start",
    [None, datetime.datetime.now().isoformat(), "invalid string"],
    ids=["no-scheduled-start", "valid-scheduled-start", "invalid-scheduled-start"],
)
def test_joblist_post(
    client,
    pipeline,
    proj_env_variables,
    pipe_env_variables,
    cron_schedule,
    scheduled_start,
):

    project = pipeline.project
    client.put(
        f"/api/projects/{project.uuid}", json={"env_variables": proj_env_variables}
    )

    client.put(
        f"/api/pipelines/{project.uuid}/{pipeline.uuid}",
        json={"env_variables": pipe_env_variables},
    )

    job_spec = create_job_spec(
        project.uuid, pipeline.uuid, cron_schedule, scheduled_start
    )
    resp = client.post("/api/jobs/", json=job_spec)

    expect_error = (
        (cron_schedule is not None and scheduled_start is not None)
        or cron_schedule == "invalid string"
        or scheduled_start == "invalid string"
    )
    expected_code = 201 if not expect_error else 500

    assert resp.status_code == expected_code

    if not expect_error:
        data = resp.get_json()
        expected_env_vars = {**proj_env_variables, **pipe_env_variables}
        assert data["env_variables"] == expected_env_vars


def test_joblist_get(client, pipeline):
    job_spec = create_job_spec(pipeline.project.uuid, pipeline.uuid)
    client.post("/api/jobs/", json=job_spec)
    job_spec = create_job_spec(pipeline.project.uuid, pipeline.uuid)
    resp = client.post("/api/jobs/", json=job_spec)

    for query_string, expected_length in [
        ({}, 2),
        ({"project_uuid": pipeline.project.uuid}, 2),
        ({"project_uuid": "proj"}, 0),
    ]:
        resp = client.get("/api/jobs/", query_string=query_string)
        data = resp.get_json()
        assert len(data["jobs"]) == expected_length
        for job in data["jobs"]:
            assert job["env_variables"] is None


def test_job_get_empty(client):
    resp = client.get("/api/jobs/uuid")
    assert resp.status_code == 404


def test_job_get_exist(client, pipeline):
    project = pipeline.project

    proj_env_variables = {"var1": 1, "var2": 2}
    client.put(
        f"/api/projects/{project.uuid}", json={"env_variables": proj_env_variables}
    )

    pipe_env_variables = {"var2": ["hello"], "var3": {}}
    client.put(
        f"/api/pipelines/{project.uuid}/{pipeline.uuid}",
        json={"env_variables": pipe_env_variables},
    )

    job_spec = create_job_spec(pipeline.project.uuid, pipeline.uuid)
    job_uuid = client.post("/api/jobs/", json=job_spec).get_json()["uuid"]

    resp = client.get(f"/api/jobs/{job_uuid}")
    assert resp.status_code == 200
    expected_env_vars = {**proj_env_variables, **pipe_env_variables}
    assert resp.get_json()["env_variables"] == expected_env_vars


@pytest.mark.parametrize(
    "env_variables",
    [None, {}, {"var1": "project-value", "var2": 10}],
    ids=["no-env-variables", "empty-env-variables", "env-variables"],
)
@pytest.mark.parametrize(
    "cron_schedule",
    [None, "* * * * *", "invalid string"],
    ids=["no-cron-string", "valid-cron-string", "invalid-cron-string"],
)
@pytest.mark.parametrize(
    "next_scheduled_time",
    [None, datetime.datetime.now().isoformat(), "invalid string"],
    ids=["no-scheduled-time", "valid-scheduled-time", "invalid-scheduled-time"],
)
@pytest.mark.parametrize(
    "parameters",
    [[{}], [{"uuid-0": i} for i in range(5)]],
    ids=["one-job-parameter", "multiple-job-parameters"],
)
def test_job_put_on_draft(
    client,
    celery,
    pipeline,
    env_variables,
    cron_schedule,
    next_scheduled_time,
    parameters,
):

    job_spec = create_job_spec(pipeline.project.uuid, pipeline.uuid)
    job_uuid = client.post("/api/jobs/", json=job_spec).get_json()["uuid"]

    job_update = {
        "env_variables": env_variables,
        "cron_schedule": cron_schedule,
        "next_scheduled_time": next_scheduled_time,
        "parameters": parameters,
        "confirm_draft": True,
    }

    resp = client.put(f"/api/jobs/{job_uuid}", json=job_update)

    expect_error = (
        (cron_schedule is not None and next_scheduled_time is not None)
        or cron_schedule == "invalid string"
        or next_scheduled_time == "invalid string"
    )
    expected_code = 200 if not expect_error else 500

    assert resp.status_code == expected_code

    # Job that need to run immediately have both set to None, while cron
    # jobs have a cron_schedule. Jobs that are to be scheduled in the
    # future won't trigger this condition.
    runs_now = cron_schedule is not None or next_scheduled_time is None
    if not expect_error and runs_now:
        # For a matter of comparison.
        if env_variables is None:
            env_variables = {}

        job = client.get(f"/api/jobs/{job_uuid}").get_json()

        # Runs of a job that has to start right now should have been
        # added to celery.
        if cron_schedule is None:
            assert celery.tasks
            assert len(celery.tasks) == len(parameters)
            for _, task_kwargs in celery.tasks:
                assert (
                    task_kwargs["kwargs"]["run_config"]["user_env_variables"]
                    == env_variables
                )

            pipeline_runs = job["pipeline_runs"]
            assert len(pipeline_runs) == len(parameters)
            # Note that the reversed is there because the runs are
            # sorted descendingly.
            for run, run_parameters in zip(pipeline_runs, reversed(parameters)):
                assert run["parameters"] == run_parameters
                assert run["status"] == "PENDING"

        assert job["status"] == "STARTED"
        assert job["env_variables"] == env_variables


def test_job_put_on_non_draft_non_cronjob(client, pipeline):
    job_spec = create_job_spec(pipeline.project.uuid, pipeline.uuid)
    job_uuid = client.post("/api/jobs/", json=job_spec).get_json()["uuid"]

    client.put(
        f"/api/jobs/{job_uuid}",
        json={
            # So that it won't run immediately.
            "next_scheduled_time": datetime.datetime.now().isoformat(),
            "confirm_draft": True,
        },
    )

    for property in [
        "env_variables",
        "cron_schedule",
        "parameters",
        "next_scheduled_time",
        "strategy_json",
    ]:
        job_update = {property: "test"}

        resp = client.put(f"/api/jobs/{job_uuid}", json=job_update)
        assert resp.status_code == 500


def test_job_put_on_non_draft_cronjob(client, pipeline):
    job_spec = create_job_spec(pipeline.project.uuid, pipeline.uuid)
    job_uuid = client.post("/api/jobs/", json=job_spec).get_json()["uuid"]

    client.put(
        f"/api/jobs/{job_uuid}",
        json={
            # So that it won't run immediately.
            "cron_schedule": "* * * * *",
            "confirm_draft": True,
        },
    )

    for property, value, expected_code in [
        ("env_variables", {}, 200),
        ("cron_schedule", "1 * * * * ", 200),
        ("parameters", [{}], 200),
        ("next_scheduled_time", datetime.datetime.now().isoformat(), 500),
        ("strategy_json", {}, 200),
    ]:
        job_update = {property: value}

        resp = client.put(f"/api/jobs/{job_uuid}", json=job_update)
        assert resp.status_code == expected_code


def test_job_put_revert(client, pipeline, monkeypatch):
    job_spec = create_job_spec(pipeline.project.uuid, pipeline.uuid)
    job_uuid = client.post("/api/jobs/", json=job_spec).get_json()["uuid"]

    # Cause an exception so that running the job fails.
    monkeypatch.setattr(namespace_jobs, "make_celery", raise_exception_function())

    resp = client.put(f"/api/jobs/{job_uuid}", json={"confirm_draft": True})
    assert resp.status_code == 500

    job = client.get(f"/api/jobs/{job_uuid}").get_json()
    assert job["status"] == "FAILURE"
    pipeline_runs = job["pipeline_runs"]
    for run in pipeline_runs:
        assert run["status"] == "FAILURE"


def test_job_delete_non_existent(client, celery):
    assert client.delete("/api/jobs/job_uuid").status_code == 404


def test_job_delete_draft_job(client, celery, pipeline, abortable_async_res):

    job_spec = create_job_spec(pipeline.project.uuid, pipeline.uuid)
    job_uuid = client.post("/api/jobs/", json=job_spec).get_json()["uuid"]
    client.delete(f"/api/jobs/{job_uuid}")

    job = client.get(f"/api/jobs/{job_uuid}").get_json()
    assert job["status"] == "ABORTED"
    assert not job["pipeline_runs"]


def test_job_delete_running_job(
    client,
    celery,
    pipeline,
    abortable_async_res,
):

    job_spec = create_job_spec(pipeline.project.uuid, pipeline.uuid)
    job_uuid = client.post("/api/jobs/", json=job_spec).get_json()["uuid"]
    client.put(f"/api/jobs/{job_uuid}", json={"confirm_draft": True})
    client.delete(f"/api/jobs/{job_uuid}")

    job = client.get(f"/api/jobs/{job_uuid}").get_json()
    assert job["status"] == "ABORTED"
    assert job["pipeline_runs"]
    for run in job["pipeline_runs"]:
        assert run["status"] == "ABORTED"
        for step in run["pipeline_steps"]:
            assert step["status"] == "ABORTED"


def test_jobdeletion_delete_non_existent(client):
    assert client.delete("/api/jobs/cleanup/job_uuid").status_code == 404


def test_jobdeletion_delete(client, celery, pipeline):

    job_spec = create_job_spec(pipeline.project.uuid, pipeline.uuid)
    job_uuid = client.post("/api/jobs/", json=job_spec).get_json()["uuid"]
    client.delete(f"/api/jobs/cleanup/{job_uuid}")

    assert client.get(f"/api/jobs/{job_uuid}").status_code == 404


def test_pipelinerun_get(client, celery, pipeline):

    job_spec = create_job_spec(pipeline.project.uuid, pipeline.uuid)
    job_uuid = client.post("/api/jobs/", json=job_spec).get_json()["uuid"]
    client.put(f"/api/jobs/{job_uuid}", json={"confirm_draft": True})

    job = client.get(f"/api/jobs/{job_uuid}").get_json()
    for run in job["pipeline_runs"]:
        resp = client.get(f'/api/jobs/{job_uuid}/{run["uuid"]}')
        assert resp.status_code == 200

        run = resp.get_json()
        assert run["env_variables"] is not None


def test_pipelinerun_set(client, celery, pipeline):

    # Multiple parameters so that the job consists of multiple pipeline
    # runs.
    job_spec = create_job_spec(
        pipeline.project.uuid, pipeline.uuid, parameters=[{}, {}, {}]
    )
    job_uuid = client.post("/api/jobs/", json=job_spec).get_json()["uuid"]
    client.put(f"/api/jobs/{job_uuid}", json={"confirm_draft": True})

    pipeline_runs = client.get(f"/api/jobs/{job_uuid}").get_json()["pipeline_runs"]
    for run in pipeline_runs:
        resp = client.put(
            f'/api/jobs/{job_uuid}/{run["uuid"]}',
            json={
                "status": "SUCCESS",
                "finished_time": datetime.datetime.now().isoformat(),
            },
        )
        print(resp.status_code)

    assert client.get(f"/api/jobs/{job_uuid}").get_json()["status"] == "SUCCESS"
