import copy
import json
import uuid
from collections import defaultdict

import requests
from flask import current_app

from _orchest.internals import config as _config
from app import error
from app.models import Pipeline, Project
from app.utils import (
    create_job_directory,
    get_environments,
    get_environments_from_pipeline_json,
    get_pipeline_json,
    get_project_directory,
    pipeline_uuid_to_path,
)


def create_job_spec(config) -> dict:
    """Returns a job spec based on the provided configuration.

    Args: Initial configuration with which the job spec should be built.
        project_uuid, pipeline_uuid, pipeline_run_spec, pipeline_name,
        name are required. Optional entries such as env_variables can be
        used to further customize the initial state of the newly created
        job.

    Returns:
        A job spec that can be POSTED to the orchest-api to create a job
        that is a duplicate of the job identified by the provided
        job_uuid.
    """
    job_spec = copy.deepcopy(config)
    pipeline_path = pipeline_uuid_to_path(
        job_spec["pipeline_uuid"], job_spec["project_uuid"]
    )
    job_spec["pipeline_run_spec"]["run_config"] = {
        "userdir_pvc": current_app.config["USERDIR_PVC"],
        "project_dir": get_project_directory(job_spec["project_uuid"]),
        "pipeline_path": pipeline_path,
    }

    job_spec["pipeline_definition"] = get_pipeline_json(
        job_spec["pipeline_uuid"], job_spec["project_uuid"]
    )

    # Validate whether the pipeline contains environments
    # that do not exist in the project.
    project_environments = get_environments(job_spec["project_uuid"])
    project_environment_uuids = set(
        [environment.uuid for environment in project_environments]
    )
    pipeline_environment_uuids = get_environments_from_pipeline_json(
        job_spec["pipeline_definition"]
    )

    missing_environment_uuids = pipeline_environment_uuids - project_environment_uuids
    if len(missing_environment_uuids) > 0:
        raise error.EnvironmentsDoNotExist(missing_environment_uuids)

    # Jobs should always have eviction enabled.
    job_spec["pipeline_definition"]["settings"]["auto_eviction"] = True

    job_uuid = str(uuid.uuid4())
    job_spec["uuid"] = job_uuid
    create_job_directory(job_uuid, job_spec["pipeline_uuid"], job_spec["project_uuid"])
    return job_spec


def duplicate_job_spec(job_uuid: str) -> dict:
    """Returns a job spec to duplicate the provided job.

    Args:
        job_uuid: UUID of the job to duplicate.

    The project, pipeline, name, schedule, env variables and parameters
    of the "parent" job are inherited. Env variables are resolved
    according to the following expression:
        job_spec["env_variables"] = {
            **current_project_env_vars,
            **current_pipeline_env_vars,
            **parent_env_vars}

    Paremeters are resolved by:
        - removing parameters that do not exist anymore.
        - adding new parameters, i.e. parameters that exist in the
          latest version of the pipeline but do not exist for the job
          that is being duplicated.
        - parameters that are not to be removed nor are new, i.e.
          parameters that exist both for the latest pipeline definition
          and the job use the values that were defined in the job that
          is being duplicated.
        - this is true for both the strategy json and the job
          parameters, where each job parameter effectively represents
          the parameterization of a run.
        - the job parameters are updated in a way that, from the client
          POV and given the logic in the job view, preserves the runs
          selection and their ordering, along with the constraint that
          every run parameterization should be unique.

    Returns:
        A job spec that can be POSTED to the orchest-api to create a job
        that is a duplicate of the job identified by the provided
        job_uuid.
    """
    resp = requests.get(
        f'http://{current_app.config["ORCHEST_API_ADDRESS"]}/api/jobs/{job_uuid}'
    )
    if resp.status_code == 404:
        raise error.JobDoesNotExist()

    parent_job = resp.json()
    job_spec = {}
    job_spec["draft"] = True
    job_spec["name"] = "Duplicate of " + parent_job["name"]
    job_spec["cron_schedule"] = parent_job["schedule"]
    job_spec["project_uuid"] = parent_job["project_uuid"]
    job_spec["pipeline_uuid"] = parent_job["pipeline_uuid"]
    job_spec["pipeline_name"] = parent_job["pipeline_name"]
    job_spec["pipeline_run_spec"] = {"run_type": "full", "uuids": []}

    if (
        Project.query.filter_by(
            uuid=job_spec["project_uuid"],
        ).one_or_none()
        is None
    ):
        raise error.ProjectDoesNotExist()

    if (
        Pipeline.query.filter_by(
            uuid=job_spec["pipeline_uuid"],
            project_uuid=job_spec["project_uuid"],
        ).one_or_none()
        is None
    ):
        raise error.PipelineDoesNotExist()

    # Resolve env variables.
    parent_env_vars = parent_job["env_variables"]
    project_env_vars = requests.get(
        f'http://{current_app.config["ORCHEST_API_ADDRESS"]}/api/projects/'
        f'{job_spec["project_uuid"]}'
    ).json()["env_variables"]
    pipeline_env_vars = requests.get(
        f'http://{current_app.config["ORCHEST_API_ADDRESS"]}/api/pipelines/'
        f'{job_spec["project_uuid"]}/{job_spec["pipeline_uuid"]}'
    ).json()["env_variables"]

    # This will merge the project and pipeline env variables then
    # add the parent job env vars, overriding existing env variables
    # and adding env variables that were not part of the project and
    # pipeline env vars. NOTE: we currently have no way to discern
    # old env variables that the job inherited from project/pipeline
    # env variables. If we could, old project/pipeline env vars that
    # do not exist anymore could be discarded.
    job_spec["env_variables"] = {
        **project_env_vars,
        **pipeline_env_vars,
        **parent_env_vars,
    }

    # Resolve parameters.
    latest_pipeline_def = get_pipeline_json(
        job_spec["pipeline_uuid"], job_spec["project_uuid"]
    )
    latest_pipeline_params = latest_pipeline_def["parameters"]
    latest_steps_params = {
        uuid: step["parameters"] for uuid, step in latest_pipeline_def["steps"].items()
    }
    st_json = parent_job["strategy_json"]
    st_json_pipe_params = st_json.get(_config.PIPELINE_PARAMETERS_RESERVED_KEY, {}).get(
        "parameters", {}
    )

    # Pipeline parameters that are new w.r.t to the inherited
    # strategy json.
    new_pipeline_parameters = {
        k: v for k, v in latest_pipeline_params.items() if k not in st_json_pipe_params
    }
    # Pipeline parameters that exist in the strategy json but that
    # have been removed from the latest version.
    removed_pipeline_parameters = {
        k for k in st_json_pipe_params if k not in latest_pipeline_params
    }
    # Steps parameters that are new w.r.t the inherited strategy
    # json.
    new_steps_parameters = defaultdict(dict)
    for latest_step, latest_step_params in latest_steps_params.items():
        if latest_step not in st_json:
            new_steps_parameters[latest_step] = copy.deepcopy(latest_step_params)
        else:
            st_json_step_parameters = st_json[latest_step]["parameters"]
            for k, v in latest_step_params.items():
                if k not in st_json_step_parameters:
                    new_steps_parameters[latest_step][k] = v
    # Steps parameters that exist in the strategy json but that have
    # been removed from the latest version.
    removed_steps_parameters = defaultdict(set)
    for st_json_step, st_json_data in st_json.items():
        if st_json_step == _config.PIPELINE_PARAMETERS_RESERVED_KEY:
            continue
        # Check which params of this step have been removed. Also
        # account if a step has been removed or does not exist
        # anymore.
        for param in st_json_data["parameters"]:
            if (
                st_json_step not in latest_steps_params
                or param not in latest_steps_params[st_json_step]
            ):
                removed_steps_parameters[st_json_step].add(param)

    # Given the current information, i.e. new and to delete
    # pipeline/steps parameters, we proceed to modify the strategy
    # json and job parameters.
    new_job_params = copy.deepcopy(parent_job["parameters"])
    new_st_json = copy.deepcopy(parent_job["strategy_json"])

    # Remove removed pipeline parameters.
    for removed_pipeline_param in removed_pipeline_parameters:
        del new_st_json[_config.PIPELINE_PARAMETERS_RESERVED_KEY]["parameters"][
            removed_pipeline_param
        ]
        for run_params in new_job_params:
            del run_params[_config.PIPELINE_PARAMETERS_RESERVED_KEY][
                removed_pipeline_param
            ]
    # Remove removed steps parameters.
    for step_with_removed_params, removed_params in removed_steps_parameters.items():
        for p in removed_params:
            del new_st_json[step_with_removed_params]["parameters"][p]
        for run_params in new_job_params:
            for p in removed_params:
                del run_params[step_with_removed_params][p]
    # Add new pipeline parameters.
    if new_pipeline_parameters:
        # In case there were no pipeline parameters before.
        if _config.PIPELINE_PARAMETERS_RESERVED_KEY not in new_st_json:
            d = dict()
            d["title"] = job_spec["pipeline_name"]
            d["key"] = _config.PIPELINE_PARAMETERS_RESERVED_KEY
            d["parameters"] = {}
            new_st_json[_config.PIPELINE_PARAMETERS_RESERVED_KEY] = d
        # Expected format for the strategy json.
        for k, v in new_pipeline_parameters.items():
            new_st_json[_config.PIPELINE_PARAMETERS_RESERVED_KEY]["parameters"][
                k
            ] = json.dumps([v])
        # Given that we use the default value specified in the
        # pipeline definition we don't have to combinatorially
        # generate new run_params.
        for run_params in new_job_params:
            if _config.PIPELINE_PARAMETERS_RESERVED_KEY not in run_params:
                run_params[_config.PIPELINE_PARAMETERS_RESERVED_KEY] = {}
            run_params[_config.PIPELINE_PARAMETERS_RESERVED_KEY].update(
                new_pipeline_parameters
            )
    # Add new steps parameters.
    for step_with_new_params, new_step_params in new_steps_parameters.items():
        if step_with_new_params not in new_st_json:
            d = dict()
            d["title"] = latest_pipeline_def["steps"][step_with_new_params]["title"]
            d["key"] = step_with_new_params
            d["parameters"] = {}
            new_st_json[step_with_new_params] = d
        # Expected format for the strategy json.
        for k, v in new_step_params.items():
            new_st_json[step_with_new_params]["parameters"][k] = json.dumps([v])
        # Given that we use the default value specified in the
        # pipeline definition we don't have to combinatorially
        # generate new run_params.
        for run_params in new_job_params:
            if step_with_new_params not in run_params:
                run_params[step_with_new_params] = {}
            run_params[step_with_new_params].update(new_step_params)

    # Empty pipeline parameters and step parameters must be dropped
    # from the strategy json and run params.
    for key in list(new_st_json):
        if not new_st_json[key]["parameters"]:
            del new_st_json[key]
    for run_params in new_job_params:
        for key in list(run_params):
            if not run_params[key]:
                del run_params[key]

    # Lastly, we have to merge run_params that are not unique
    # anymore, given that the deletion of some step or pipeline
    # parameters could have caused the loss of uniqueness. Use the
    # fact that starting with python 3.7 dictionaries preserve the
    # insertion order to preserve the order when merging.
    new_job_params = {json.dumps(k, sort_keys=True): None for k in new_job_params}
    new_job_params = [json.loads(k) for k in new_job_params]

    job_spec["parameters"] = new_job_params
    job_spec["strategy_json"] = new_st_json
    return create_job_spec(job_spec)
