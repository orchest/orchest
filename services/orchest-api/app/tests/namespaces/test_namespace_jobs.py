import datetime

import pytest
from tests.test_utils import create_job_spec

from _orchest.internals.test_utils import raise_exception_function
from _orchest.internals.two_phase_executor import TwoPhaseExecutor
from app.apis import namespace_jobs
from app.connections import db


@pytest.mark.parametrize(
    "query_string", [{}, {"project_uuid": "proj"}], ids=["no-filter", "project"]
)
def test_joblist_get_empty(client, query_string):
    resp = client.get("/api/jobs/", query_string=query_string)
    assert resp.status_code == 200
    assert not resp.get_json()["jobs"]


@pytest.mark.parametrize(
    "proj_env_variables",
    [{}, {"var1": "project-value", "var2": "10"}],
    ids=["no-proj-variables", "proj-variables"],
)
@pytest.mark.parametrize(
    "pipe_env_variables",
    [{}, {"var1": "pipeline-value", "var3": "[1]"}],
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

    proj_env_variables = {"var1": "1", "var2": "2"}
    client.put(
        f"/api/projects/{project.uuid}", json={"env_variables": proj_env_variables}
    )

    pipe_env_variables = {"var2": '["hello"]', "var3": "{}"}
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
    [None, {}, {"var1": "project-value", "var2": "10"}],
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

            pipeline_runs = client.get(
                f"/api/jobs/{job_uuid}/pipeline_runs"
            ).get_json()["pipeline_runs"]
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
    pipeline_runs = client.get(f"/api/jobs/{job_uuid}/pipeline_runs").get_json()[
        "pipeline_runs"
    ]
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
    assert not client.get(f"/api/jobs/{job_uuid}/pipeline_runs").get_json()[
        "pipeline_runs"
    ]


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
    pipeline_runs = client.get(f"/api/jobs/{job_uuid}/pipeline_runs").get_json()[
        "pipeline_runs"
    ]
    assert pipeline_runs
    for run in pipeline_runs:
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

    pipeline_runs = client.get(f"/api/jobs/{job_uuid}/pipeline_runs").get_json()[
        "pipeline_runs"
    ]
    for run in pipeline_runs:
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

    pipeline_runs = client.get(f"/api/jobs/{job_uuid}/pipeline_runs").get_json()[
        "pipeline_runs"
    ]
    print(pipeline_runs)
    for run in pipeline_runs:
        client.put(
            f'/api/jobs/{job_uuid}/{run["uuid"]}',
            json={
                "status": "SUCCESS",
                "finished_time": datetime.datetime.now().isoformat(),
            },
        )

    assert client.get(f"/api/jobs/{job_uuid}").get_json()["status"] == "SUCCESS"


def test_pipelinerun_delete_non_existent(client, celery):
    assert client.delete("/api/jobs/job_uuid/pipeline_uuid").status_code == 404


def test_pipelinerun_delete_one_run(
    client,
    celery,
    pipeline,
    abortable_async_res,
):

    # Multiple parameters so that the job consists of multiple pipeline
    # runs.
    job_spec = create_job_spec(
        pipeline.project.uuid, pipeline.uuid, parameters=[{}, {}, {}]
    )
    job_uuid = client.post("/api/jobs/", json=job_spec).get_json()["uuid"]
    client.put(f"/api/jobs/{job_uuid}", json={"confirm_draft": True})

    pipeline_runs = client.get(f"/api/jobs/{job_uuid}/pipeline_runs").get_json()[
        "pipeline_runs"
    ]
    # Cancel the first run, leave the other 2.
    assert (
        client.delete(
            f'/api/jobs/{job_uuid}/{pipeline_runs[0]["uuid"]}',
        ).status_code
        == 200
    )

    pipeline_runs = client.get(f"/api/jobs/{job_uuid}/pipeline_runs").get_json()[
        "pipeline_runs"
    ]
    assert pipeline_runs[0]["status"] == "ABORTED"
    assert pipeline_runs[1]["status"] == "PENDING"
    assert pipeline_runs[2]["status"] == "PENDING"
    assert client.get(f"/api/jobs/{job_uuid}").get_json()["status"] == "STARTED"


def test_pipelinerun_delete_all_runs(
    client,
    celery,
    pipeline,
    abortable_async_res,
):

    # Multiple parameters so that the job consists of multiple pipeline
    # runs.
    job_spec = create_job_spec(
        pipeline.project.uuid, pipeline.uuid, parameters=[{}, {}, {}]
    )
    job_uuid = client.post("/api/jobs/", json=job_spec).get_json()["uuid"]
    client.put(f"/api/jobs/{job_uuid}", json={"confirm_draft": True})

    pipeline_runs = client.get(f"/api/jobs/{job_uuid}/pipeline_runs").get_json()[
        "pipeline_runs"
    ]
    for run in pipeline_runs:
        assert (
            client.delete(
                f'/api/jobs/{job_uuid}/{run["uuid"]}',
            ).status_code
            == 200
        )

    pipeline_runs = client.get(f"/api/jobs/{job_uuid}/pipeline_runs").get_json()[
        "pipeline_runs"
    ]
    assert client.get(f"/api/jobs/{job_uuid}").get_json()["status"] == "SUCCESS"


def test_pipelinerundeletion_non_existent(client, celery):
    assert client.delete("/api/jobs/cleanup/job_uuid/pipeline_uuid").status_code == 404


def test_pipelinerundeletion_one_run(
    client,
    celery,
    pipeline,
    abortable_async_res,
):

    # Multiple parameters so that the job consists of multiple pipeline
    # runs.
    job_spec = create_job_spec(
        pipeline.project.uuid, pipeline.uuid, parameters=[{}, {}, {}]
    )
    job_uuid = client.post("/api/jobs/", json=job_spec).get_json()["uuid"]
    client.put(f"/api/jobs/{job_uuid}", json={"confirm_draft": True})

    pipeline_runs = client.get(f"/api/jobs/{job_uuid}/pipeline_runs").get_json()[
        "pipeline_runs"
    ]
    # Cancel the first run, leave the other 2.
    assert (
        client.delete(
            f'/api/jobs/cleanup/{job_uuid}/{pipeline_runs[0]["uuid"]}',
        ).status_code
        == 200
    )

    celery_task_kwargs = {
        "project_uuid": pipeline.project.uuid,
        "pipeline_uuid": pipeline.uuid,
        "job_uuid": job_uuid,
        "pipeline_run_uuids": [pipeline_runs[0]["uuid"]],
    }
    assert any([task[1]["kwargs"] == celery_task_kwargs for task in celery.tasks])

    pipeline_runs = client.get(f"/api/jobs/{job_uuid}/pipeline_runs").get_json()[
        "pipeline_runs"
    ]
    assert len(pipeline_runs) == 2
    assert pipeline_runs[0]["status"] == "PENDING"
    assert pipeline_runs[1]["status"] == "PENDING"
    assert client.get(f"/api/jobs/{job_uuid}").get_json()["status"] == "STARTED"


def test_pipelinerundeletion_all_runs(
    client,
    celery,
    pipeline,
    abortable_async_res,
):

    # Multiple parameters so that the job consists of multiple pipeline
    # runs.
    job_spec = create_job_spec(
        pipeline.project.uuid, pipeline.uuid, parameters=[{}, {}, {}]
    )
    job_uuid = client.post("/api/jobs/", json=job_spec).get_json()["uuid"]
    client.put(f"/api/jobs/{job_uuid}", json={"confirm_draft": True})

    pipeline_runs = client.get(f"/api/jobs/{job_uuid}/pipeline_runs").get_json()[
        "pipeline_runs"
    ]
    for run in pipeline_runs:
        assert (
            client.delete(
                f'/api/jobs/cleanup/{job_uuid}/{run["uuid"]}',
            ).status_code
            == 200
        )

    for run in pipeline_runs:
        celery_task_kwargs = {
            "project_uuid": pipeline.project.uuid,
            "pipeline_uuid": pipeline.uuid,
            "job_uuid": job_uuid,
            "pipeline_run_uuids": [run["uuid"]],
        }
    assert any([task[1]["kwargs"] == celery_task_kwargs for task in celery.tasks])

    pipeline_runs = client.get(f"/api/jobs/{job_uuid}/pipeline_runs").get_json()[
        "pipeline_runs"
    ]
    assert not pipeline_runs
    assert client.get(f"/api/jobs/{job_uuid}").get_json()["status"] == "SUCCESS"


def test_delete_non_retained_job_pipeline_runs_on_job_run_retain_all(
    test_app, client, celery, pipeline, abortable_async_res, monkeypatch, mocker
):
    # Multiple parameters so that the job consists of multiple pipeline
    # runs.
    job_spec = create_job_spec(
        pipeline.project.uuid, pipeline.uuid, parameters=[{}, {}, {}]
    )
    job_uuid = client.post("/api/jobs/", json=job_spec).get_json()["uuid"]
    client.put(
        f"/api/jobs/{job_uuid}",
        json={"confirm_draft": True, "cron_schedule": "* * * * *"},
    )

    # Trigger a job run.
    with test_app.app_context():
        with TwoPhaseExecutor(db.session) as tpe:
            namespace_jobs.RunJob(tpe).transaction(job_uuid)

    # Set as done the pipeline runs of this job run.
    pipeline_runs = client.get(f"/api/jobs/{job_uuid}/pipeline_runs").get_json()[
        "pipeline_runs"
    ]
    for run in pipeline_runs:
        client.put(
            f'/api/jobs/{job_uuid}/{run["uuid"]}',
            json={
                "status": "SUCCESS",
                "finished_time": datetime.datetime.now().isoformat(),
            },
        )
    pipeline_runs = client.get(f"/api/jobs/{job_uuid}/pipeline_runs").get_json()[
        "pipeline_runs"
    ]
    for run in pipeline_runs:
        assert run["status"] == "SUCCESS"

    # Trigger another job run.
    with test_app.app_context():
        with TwoPhaseExecutor(db.session) as tpe:
            namespace_jobs.RunJob(tpe).transaction(job_uuid)

    # The previously existing pipeline runs should still be there.
    pipeline_runs = client.get(f"/api/jobs/{job_uuid}/pipeline_runs").get_json()[
        "pipeline_runs"
    ]
    assert len(pipeline_runs) == 6
    assert all(
        [
            task[1]["name"] != "app.core.tasks.delete_job_pipeline_run_directories"
            for task in celery.tasks
        ]
    )


@pytest.mark.parametrize("max_retained_pipeline_runs", [3, 4, 5, 6, 9])
def test_delete_non_retained_job_pipeline_runs_on_job_run_retain_n(
    max_retained_pipeline_runs,
    test_app,
    client,
    celery,
    pipeline,
    abortable_async_res,
    monkeypatch,
    mocker,
):
    # Multiple parameters so that the job consists of multiple pipeline
    # runs.
    job_spec = create_job_spec(
        pipeline.project.uuid,
        pipeline.uuid,
        parameters=[{}, {}, {}],
        max_retained_pipeline_runs=max_retained_pipeline_runs,
    )
    job_uuid = client.post("/api/jobs/", json=job_spec).get_json()["uuid"]
    client.put(
        f"/api/jobs/{job_uuid}",
        json={"confirm_draft": True, "cron_schedule": "* * * * *"},
    )

    # Trigger a job run.
    with test_app.app_context():
        with TwoPhaseExecutor(db.session) as tpe:
            namespace_jobs.RunJob(tpe).transaction(job_uuid)

    # Set as done the pipeline runs of this job run.
    first_pipeline_runs = client.get(f"/api/jobs/{job_uuid}/pipeline_runs").get_json()[
        "pipeline_runs"
    ]
    for run in first_pipeline_runs:
        client.put(
            f'/api/jobs/{job_uuid}/{run["uuid"]}',
            json={
                "status": "SUCCESS",
                "finished_time": datetime.datetime.now().isoformat(),
            },
        )

    # Reset the mock, deletions should only happen the next time RunJob
    # is triggered, for this case.
    celery.task = []

    # Trigger another job run.
    with test_app.app_context():
        with TwoPhaseExecutor(db.session) as tpe:
            namespace_jobs.RunJob(tpe).transaction(job_uuid)

    pipeline_runs = client.get(f"/api/jobs/{job_uuid}/pipeline_runs").get_json()[
        "pipeline_runs"
    ]
    # Can't delete more than 3 since we have 3 runs in an end state.
    expected_deleted_runs_n = max(0, min(3, 6 - max_retained_pipeline_runs))
    assert len(pipeline_runs) == 6 - expected_deleted_runs_n
    first_pipeline_runs.sort(key=lambda x: x["pipeline_run_index"])
    expected_deleted_run_uuids = set(
        [run["uuid"] for run in first_pipeline_runs[:expected_deleted_runs_n]]
    )
    deleted_run_uuids = set(
        [
            uuid
            for task in celery.tasks
            if task[1]["name"] == "app.core.tasks.delete_job_pipeline_run_directories"
            for uuid in task[1]["kwargs"]["pipeline_run_uuids"]
        ]
    )
    assert expected_deleted_run_uuids == deleted_run_uuids


def test_delete_non_retained_job_pipeline_runs_on_job_run_update_retain_all(
    test_app, client, celery, pipeline, abortable_async_res, monkeypatch, mocker
):
    job_spec = create_job_spec(
        pipeline.project.uuid, pipeline.uuid, parameters=[{}, {}, {}, {}]
    )
    job_uuid = client.post("/api/jobs/", json=job_spec).get_json()["uuid"]
    client.put(
        f"/api/jobs/{job_uuid}",
        json={"confirm_draft": True, "cron_schedule": "* * * * *"},
    )

    # Trigger a job run.
    with test_app.app_context():
        with TwoPhaseExecutor(db.session) as tpe:
            namespace_jobs.RunJob(tpe).transaction(job_uuid)

    # Set as done the pipeline runs of this job run.
    pipeline_runs = client.get(f"/api/jobs/{job_uuid}/pipeline_runs").get_json()[
        "pipeline_runs"
    ]
    for run in pipeline_runs:
        client.put(
            f'/api/jobs/{job_uuid}/{run["uuid"]}',
            json={
                "status": "SUCCESS",
                "finished_time": datetime.datetime.now().isoformat(),
            },
        )
    pipeline_runs = client.get(f"/api/jobs/{job_uuid}/pipeline_runs").get_json()[
        "pipeline_runs"
    ]
    for run in pipeline_runs:
        assert run["status"] == "SUCCESS"
    assert all(
        [
            task[1]["name"] != "app.core.tasks.delete_job_pipeline_run_directories"
            for task in celery.tasks
        ]
    )


@pytest.mark.parametrize("max_retained_pipeline_runs", [0, 1, 2, 3, 6])
def test_delete_non_retained_job_pipeline_runs_on_job_run_update_retain_n(
    max_retained_pipeline_runs,
    test_app,
    client,
    celery,
    pipeline,
    abortable_async_res,
    monkeypatch,
    mocker,
):
    # Multiple parameters so that the job consists of multiple pipeline
    # runs.
    job_spec = create_job_spec(
        pipeline.project.uuid,
        pipeline.uuid,
        parameters=[{}, {}, {}],
        max_retained_pipeline_runs=max_retained_pipeline_runs,
    )
    job_uuid = client.post("/api/jobs/", json=job_spec).get_json()["uuid"]
    client.put(
        f"/api/jobs/{job_uuid}",
        json={"confirm_draft": True, "cron_schedule": "* * * * *"},
    )

    # Trigger a job run.
    with test_app.app_context():
        with TwoPhaseExecutor(db.session) as tpe:
            namespace_jobs.RunJob(tpe).transaction(job_uuid)

    # Set as done the pipeline runs of this job run.
    pipeline_runs = client.get(f"/api/jobs/{job_uuid}/pipeline_runs").get_json()[
        "pipeline_runs"
    ]
    for run in pipeline_runs:
        client.put(
            f'/api/jobs/{job_uuid}/{run["uuid"]}',
            json={
                "status": "SUCCESS",
                "finished_time": datetime.datetime.now().isoformat(),
            },
        )

    expected_deleted_runs_n = max(0, 3 - max_retained_pipeline_runs)

    pipeline_runs.sort(key=lambda x: x["pipeline_run_index"])
    expected_deleted_run_uuids = set(
        [run["uuid"] for run in pipeline_runs[:expected_deleted_runs_n]]
    )
    deleted_run_uuids = set(
        [
            uuid
            for task in celery.tasks
            if task[1]["name"] == "app.core.tasks.delete_job_pipeline_run_directories"
            for uuid in task[1]["kwargs"]["pipeline_run_uuids"]
        ]
    )
    assert expected_deleted_run_uuids == deleted_run_uuids
