import copy
import json
import random

import pytest
import requests
from tests.test_utils import MockRequestReponse

from _orchest.internals import config as _config
from app.core import jobs


def _get_parent_job_spec(
    project_uuid="project-uuid",
    pipeline_uuid="pipeline-uuid",
    name="job-name",
    schedule=None,
    pipeline_name="pipeline-name",
    env_variables=None,
    strategy_json=None,
    parameters=None,
):
    return {
        "name": name,
        "schedule": schedule,
        "project_uuid": project_uuid,
        "pipeline_uuid": pipeline_uuid,
        "pipeline_name": pipeline_name,
        "env_variables": {} if env_variables is None else env_variables,
        "strategy_json": {} if strategy_json is None else strategy_json,
        "parameters": [{}] if parameters is None else parameters,
    }


def _update_runs_parameters(parameters, target, name, values):
    tmp_parameters = []
    for value in values:
        for run_params in parameters:
            tmp_run_params = copy.deepcopy(run_params)
            if target not in tmp_run_params:
                tmp_run_params[target] = {}
            tmp_run_params[target][name] = value
            tmp_parameters.append(tmp_run_params)
    return tmp_parameters


def test_duplicate_job_no_job(client, monkeypatch):
    def mock_get_request(url, json=None, *args, **kwargs):
        return MockRequestReponse(404)

    monkeypatch.setattr(requests, "get", mock_get_request)

    resp = client.post("/catch/api-proxy/api/jobs/duplicate", json={"job_uuid": ""})

    assert resp.status_code == 409
    assert "it does not exist" in resp.get_json()["message"]


def test_duplicate_job_no_project(client, monkeypatch):
    def mock_get_request(url, json=None, *args, **kwargs):
        return MockRequestReponse(200, _get_parent_job_spec())

    monkeypatch.setattr(requests, "get", mock_get_request)
    resp = client.post("/catch/api-proxy/api/jobs/duplicate", json={"job_uuid": ""})

    assert resp.status_code == 409
    assert "project does not exist" in resp.get_json()["message"]


def test_duplicate_job_no_pipeline(client, project, monkeypatch):
    def mock_get_request(url, json=None, *args, **kwargs):
        return MockRequestReponse(200, _get_parent_job_spec(project.uuid))

    monkeypatch.setattr(requests, "get", mock_get_request)
    resp = client.post("/catch/api-proxy/api/jobs/duplicate", json={"job_uuid": ""})

    assert resp.status_code == 409
    assert "pipeline does not exist" in resp.get_json()["message"]


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
    "job_env_variables",
    [{}, {"var1": "job-value", "var2": [20], "var4": "test"}],
    ids=["no-job-variables", "job-variables"],
)
def test_duplicate_job_env_variables(
    client,
    pipeline,
    proj_env_variables,
    pipe_env_variables,
    job_env_variables,
    monkeypatch,
):
    def mock_get_request(url, json=None, *args, **kwargs):
        # Return the parent job.
        if "/api/jobs" in url:
            return MockRequestReponse(
                200,
                _get_parent_job_spec(
                    pipeline.project.uuid,
                    pipeline.uuid,
                    env_variables=job_env_variables,
                ),
            )
        # Return the project env vars.
        if "/api/projects" in url:
            return MockRequestReponse(200, {"env_variables": proj_env_variables})
        # Return the pipeline env vars.
        if "/api/pipelines" in url:
            return MockRequestReponse(200, {"env_variables": pipe_env_variables})

    posted_json = None

    def mock_post_request(self, url="", json=None, *args, **kwargs):
        nonlocal posted_json
        posted_json = json
        return MockRequestReponse()

    monkeypatch.setattr(requests, "get", mock_get_request)
    monkeypatch.setattr(requests, "post", mock_post_request)
    monkeypatch.setattr(jobs, "create_job_spec", lambda spec: spec)

    pipeline_definition = {"parameters": {}, "steps": {}}

    monkeypatch.setattr(
        jobs, "get_pipeline_json", lambda *args, **kwargs: pipeline_definition
    )
    resp = client.post("/catch/api-proxy/api/jobs/duplicate", json={"job_uuid": ""})

    assert resp.status_code == 200
    assert posted_json["env_variables"] == {
        **proj_env_variables,
        **pipe_env_variables,
        **job_env_variables,
    }


@pytest.mark.parametrize(
    "schedule",
    ["* * * * *"],
    ids=["schedule"],
)
@pytest.mark.parametrize(
    "removed_pipeline_parameters",
    [
        {},
        {
            "removed-pipeline-parameter-1": [1, 2, 3],
            "removed-step-parameter-2": ["1", "2", "3"],
        },
    ],
    ids=["no-removed-pipeline-params", "removed-pipeline-params"],
)
@pytest.mark.parametrize(
    "removed_step_parameters",
    [
        {},
        {
            "removed-step-parameter-1": [10, 20, 30],
            "removed-step-parameter-2": ["10", "20", "30"],
        },
    ],
    ids=["no-removed-step-params", "removed-step-params"],
)
@pytest.mark.parametrize(
    "overlapping_pipeline_parameters",
    [
        {},
        {
            "overlapping-pipeline-parameter-1": [1, 2, 3],
            "overlapping-pipeline-parameter-2": ["2", "3", "3"],
            "overlapping-pipeline-parameter-3": [3, 4, 4, 4],
        },
    ],
    ids=["no-overlapping-pipeline-params", "overlapping-pipeline-params"],
)
@pytest.mark.parametrize(
    "overlapping_step_parameters",
    [
        {},
        {
            "overlapping-step-parameter-1": [10, 20, 30],
            "overlapping-step-parameter-2": ["20", "30"],
            "overlapping-step-parameter-3": [30, 40, 40],
        },
    ],
    ids=["no-overlapping-step-params", "overlapping-step-params"],
)
@pytest.mark.parametrize(
    "new_pipeline_parameters",
    [
        {},
        {
            "new-pipeline-parameter-1": 1,
            "new-pipeline-parameter-2": "2",
            "new-pipeline-parameter-3": [3, 3],
        },
    ],
    ids=["no-new-pipeline-params", "new-pipeline-params"],
)
@pytest.mark.parametrize(
    "new_step_parameters",
    [
        {},
        {
            "new-step-parameter-1": 10,
            "new-step-parameter-2": "20",
            "new-step-parameter-3": [30],
        },
    ],
    ids=["no-new-step-params", "new-step-params"],
)
@pytest.mark.parametrize(
    "random_seed", list(range(1)), ids=[f"seed={i}" for i in range(1)]
)
@pytest.mark.parametrize(
    "runs_parameterizations_subset", [None, 10], ids=[None, "first-10"]
)
def test_duplicate_job_spec_configuration(
    client,
    pipeline,
    schedule,
    removed_pipeline_parameters,
    removed_step_parameters,
    overlapping_pipeline_parameters,
    overlapping_step_parameters,
    new_pipeline_parameters,
    new_step_parameters,
    random_seed,
    runs_parameterizations_subset,
    monkeypatch,
):
    # We will use this to shuffle.
    random.seed(random_seed)

    step_name = "step-a"
    parent_job_strategy_json = {}
    parent_job_parameters = [{}]

    # Removed parameters are added to the strategy json and parameters,
    # but not added to the "latest" pipeline definition. Overlapping
    # parameters are added to both the strategy json + parameters and
    # the pipeline definition.
    if removed_pipeline_parameters or overlapping_pipeline_parameters:
        parent_job_strategy_json[_config.PIPELINE_PARAMETERS_RESERVED_KEY] = {
            "key": _config.PIPELINE_PARAMETERS_RESERVED_KEY,
            "title": "title",
            "parameters": {},
        }
    for param, values in list(removed_pipeline_parameters.items()) + list(
        overlapping_pipeline_parameters.items()
    ):
        parent_job_strategy_json[_config.PIPELINE_PARAMETERS_RESERVED_KEY][
            "parameters"
        ][param] = json.dumps(values)
        parent_job_parameters = _update_runs_parameters(
            parent_job_parameters,
            _config.PIPELINE_PARAMETERS_RESERVED_KEY,
            param,
            values,
        )

    if removed_step_parameters or overlapping_step_parameters:
        parent_job_strategy_json[step_name] = {
            "key": step_name,
            "title": step_name,
            "parameters": {},
        }
    for param, values in list(removed_step_parameters.items()) + list(
        overlapping_step_parameters.items()
    ):
        parent_job_strategy_json[step_name]["parameters"][param] = json.dumps(values)
        parent_job_parameters = _update_runs_parameters(
            parent_job_parameters, step_name, param, values
        )
    random.shuffle(parent_job_parameters)
    if runs_parameterizations_subset is not None:
        parent_job_parameters = parent_job_parameters[runs_parameterizations_subset:]

    def mock_get_request(url, json=None, *args, **kwargs):
        # Return the parent job.
        if "/api/jobs" in url:
            return MockRequestReponse(
                200,
                _get_parent_job_spec(
                    pipeline.project.uuid,
                    pipeline.uuid,
                    schedule=schedule,
                    parameters=parent_job_parameters,
                    strategy_json=parent_job_strategy_json,
                ),
            )
        # Return the project env vars.
        if "/api/projects" in url:
            return MockRequestReponse(200, {"env_variables": {}})
        # Return the pipeline env vars.
        if "/api/pipelines" in url:
            return MockRequestReponse(200, {"env_variables": {}})

    posted_json = None

    def mock_post_request(self, url="", json=None, *args, **kwargs):
        nonlocal posted_json
        posted_json = json
        return MockRequestReponse()

    monkeypatch.setattr(requests, "get", mock_get_request)
    monkeypatch.setattr(requests, "post", mock_post_request)
    monkeypatch.setattr(jobs, "create_job_spec", lambda spec: spec)

    # New parameters are added to the "latest" pipeline definition, but
    # not to the parent job strategy json and parameters. Overlapping
    # parameters are added to both the parent job strategy json and
    # parameters and the pipeline definition.
    pipeline_definition = {
        "parameters": copy.deepcopy(new_pipeline_parameters),
        "steps": {
            step_name: {
                "title": step_name,
                "parameters": copy.deepcopy(new_step_parameters),
            }
        },
    }
    for k in overlapping_pipeline_parameters:
        pipeline_definition["parameters"][k] = "should-be-overriden"
    for k in overlapping_step_parameters:
        pipeline_definition["steps"][step_name]["parameters"][k] = "should-be-overriden"

    monkeypatch.setattr(
        jobs, "get_pipeline_json", lambda *args, **kwargs: pipeline_definition
    )
    resp = client.post("/catch/api-proxy/api/jobs/duplicate", json={"job_uuid": ""})

    assert resp.status_code == 200
    assert posted_json["cron_schedule"] == schedule

    # Assert that removed parameters have been accounted for.
    for run_parameters in posted_json["parameters"]:
        if not new_pipeline_parameters and not overlapping_pipeline_parameters:
            assert _config.PIPELINE_PARAMETERS_RESERVED_KEY not in run_parameters
        else:
            for k in removed_pipeline_parameters:
                assert k not in run_parameters[_config.PIPELINE_PARAMETERS_RESERVED_KEY]

        if not new_step_parameters and not overlapping_step_parameters:
            assert step_name not in run_parameters
        else:
            for k in removed_pipeline_parameters:
                assert k not in run_parameters[step_name]

    # Assert that new parameters have been added.
    for run_parameters in posted_json["parameters"]:
        for key, value in new_pipeline_parameters.items():
            assert (
                run_parameters[_config.PIPELINE_PARAMETERS_RESERVED_KEY][key] == value
            )

        for key, value in new_step_parameters.items():
            assert run_parameters[step_name][key] == value

    # Here we are verifying the overlapping parameters, making sure that
    # the order has been respected and that the user selection has been
    # respected.
    # For each new run parameterization map the string dump to its
    # index. We will use the string dump for equality later and the
    # index to verify ordering and selection.
    new_runs_parameters_to_index = {}
    for i, params in enumerate(posted_json["parameters"]):
        params = copy.deepcopy(params)

        # Remove the new pipeline parameters to match the "old"
        # parameterization.
        for k in new_pipeline_parameters:
            del params[_config.PIPELINE_PARAMETERS_RESERVED_KEY][k]
        if (
            _config.PIPELINE_PARAMETERS_RESERVED_KEY in params
            and not params[_config.PIPELINE_PARAMETERS_RESERVED_KEY]
        ):
            del params[_config.PIPELINE_PARAMETERS_RESERVED_KEY]

        for k in new_step_parameters:
            del params[step_name][k]
        if step_name in params and not params[step_name]:
            del params[step_name]

        json_dump = json.dumps(params, sort_keys=True)
        assert json_dump not in new_runs_parameters_to_index
        new_runs_parameters_to_index[json_dump] = i

    # For each run parameterization of the parent job account for the
    # removed parameters, then make sure that the ordering of the new
    # parameterizations is correct.
    index = -1
    already_checked = set()
    for params in parent_job_parameters:
        params = copy.deepcopy(params)

        for k in removed_pipeline_parameters:
            del params[_config.PIPELINE_PARAMETERS_RESERVED_KEY][k]
        if (
            _config.PIPELINE_PARAMETERS_RESERVED_KEY in params
            and not params[_config.PIPELINE_PARAMETERS_RESERVED_KEY]
        ):
            del params[_config.PIPELINE_PARAMETERS_RESERVED_KEY]

        for k in removed_step_parameters:
            del params[step_name][k]
        if step_name in params and not params[step_name]:
            del params[step_name]

        json_dump = json.dumps(params, sort_keys=True)
        # Account for the fact that removing the removed parameters
        # might introduced non uniqueness.
        if json_dump not in already_checked:
            already_checked.add(json_dump)
            found_at = new_runs_parameters_to_index.get(json_dump, -1)
            # Make sure the ordering has been respected and that the
            # specific parameterization has been found.
            assert found_at > index
            index = found_at

    # Finalize checking that the selection is respected.
    assert len(already_checked) == len(posted_json["parameters"])
