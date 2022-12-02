import copy
import json
import os
import subprocess
import uuid
from collections import defaultdict

import requests
from flask import current_app
from werkzeug.utils import safe_join

import app.utils as utils
from _orchest.internals import analytics
from _orchest.internals import config as _config
from _orchest.internals import utils as _utils
from app import error
from app.config import CONFIG_CLASS as config
from app.models import Pipeline, Project


def _create_job_spec(config) -> dict:
    job_spec = copy.deepcopy(config)
    pipeline_path = utils.pipeline_uuid_to_path(
        job_spec["pipeline_uuid"], job_spec["project_uuid"]
    )
    job_spec["pipeline_run_spec"]["run_config"] = {
        "userdir_pvc": current_app.config["USERDIR_PVC"],
        "project_dir": utils.get_project_directory(job_spec["project_uuid"]),
        "pipeline_path": pipeline_path,
    }

    job_spec["pipeline_definition"] = utils.get_pipeline_json(
        job_spec["pipeline_uuid"], job_spec["project_uuid"]
    )

    # Jobs should always have eviction enabled.
    job_spec["pipeline_definition"]["settings"]["auto_eviction"] = True

    job_uuid = str(uuid.uuid4())
    job_spec["uuid"] = job_uuid
    job_spec["snapshot_uuid"] = create_job_directory(
        job_uuid, job_spec["pipeline_uuid"], job_spec["project_uuid"]
    )
    return job_spec


def create_job(config) -> requests.Response:
    """Returns a job spec based on the provided configuration.

    Args: Initial configuration with which the job spec should be built.
        project_uuid, pipeline_uuid, pipeline_run_spec, pipeline_name,
        name are required. Optional entries such as env_variables can be
        used to further customize the initial state of the newly created
        job.

    Returns:
        Response of the orchest-api job creation query.
    """
    job_spec = _create_job_spec(config)
    resp = requests.post(
        "http://" + current_app.config["ORCHEST_API_ADDRESS"] + "/api/jobs/",
        json=job_spec,
    )
    if resp.status_code != 201:
        remove_job_directory(
            job_spec["uuid"],
            job_spec["pipeline_uuid"],
            job_spec["project_uuid"],
            job_spec["snapshot_uuid"],
        )
    return resp


def duplicate_job(job_uuid: str) -> requests.Response:
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
        Response of the orchest-api job creation query.
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
    job_spec["max_retained_pipeline_runs"] = parent_job["max_retained_pipeline_runs"]

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
    latest_pipeline_def = utils.get_pipeline_json(
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

    event_type = analytics.Event.ONE_OFF_JOB_DUPLICATED
    if job_spec["cron_schedule"] is not None:
        event_type = analytics.Event.CRON_JOB_DUPLICATED

    job_spec = _create_job_spec(job_spec)

    analytics.send_event(
        current_app,
        event_type,
        analytics.TelemetryData(
            event_properties={
                "project": {
                    "uuid": job_spec["project_uuid"],
                    "job": {
                        "uuid": job_uuid,
                        "new_job_uuid": job_spec["uuid"],
                    },
                },
                "duplicate_from": job_uuid,
                # Deprecated fields, kept to not break the analytics
                # BE schema.
                "job_definition": None,
                "snapshot_size": None,
                "deprecated": [
                    "duplicated_from",
                    "job_definition",
                    "snapshot_size",
                ],
            },
            derived_properties={},
        ),
    )

    resp = requests.post(
        "http://" + current_app.config["ORCHEST_API_ADDRESS"] + "/api/jobs/",
        json=job_spec,
    )
    if resp.status_code != 201:
        remove_job_directory(
            job_spec["uuid"],
            job_spec["pipeline_uuid"],
            job_spec["project_uuid"],
            job_spec["snapshot_uuid"],
        )
    return resp


def create_job_directory(job_uuid: str, pipeline_uuid: str, project_uuid: str) -> str:
    """Creates the job directory and prepares a snapshot for the job.

    Returns:
        The uuid of the snapshot.
    """

    snapshot_path = utils.get_snapshot_directory(pipeline_uuid, project_uuid, job_uuid)

    os.makedirs(os.path.split(snapshot_path)[0], exist_ok=True)

    project_dir = safe_join(
        current_app.config["USER_DIR"],
        "projects",
        utils.project_uuid_to_path(project_uuid),
    )

    _utils.copytree(project_dir, snapshot_path, use_gitignore=True)
    return _create_snapshot_record_for_job(job_uuid, pipeline_uuid, project_uuid)


def remove_job_directory(
    job_uuid: str, pipeline_uuid: str, project_uuid: str, snapshot_uuid: str
):
    """Deletes the job directory and the associated snapshot.

    The associated job will be deleted, and if necessary, its runs
    aborted.
    """

    job_project_path = safe_join(current_app.config["USER_DIR"], "jobs", project_uuid)
    job_pipeline_path = safe_join(job_project_path, pipeline_uuid)
    job_path = safe_join(job_pipeline_path, job_uuid)

    if os.path.isdir(job_path):
        _utils.rmtree(job_path, ignore_errors=True)

    # Clean up parent directory if this job removal created empty
    # directories.
    utils.remove_dir_if_empty(job_pipeline_path)
    utils.remove_dir_if_empty(job_project_path)

    resp = requests.delete(
        (
            "http://" + current_app.config["ORCHEST_API_ADDRESS"] + "/api/snapshots"
            f"/{snapshot_uuid}"
        )
    )
    if resp.status_code != 200:
        raise error.OrchestApiRequestError(response=resp)


def _create_snapshot_record_for_job(
    job_uuid: str, pipeline_uuid: str, project_uuid: str
) -> str:

    # with_for_update to avoid pipeline moves during the snapshotting.
    pipelines = Pipeline.query.with_for_update().filter(
        Pipeline.project_uuid == project_uuid
    )

    snap_spec_pipelines = {}
    for ppl in pipelines:
        snap_spec_pipelines[ppl.uuid] = {
            "path": ppl.path,
            "definition": utils.get_pipeline_json(
                pipeline_uuid,
                project_uuid,
                utils.get_pipeline_path(
                    pipeline_uuid=pipeline_uuid,
                    project_uuid=project_uuid,
                    pipeline_path=ppl.path,
                ),
            ),
        }

    snapshot_spec = {"project_uuid": project_uuid, "pipelines": snap_spec_pipelines}
    resp = requests.post(
        "http://" + current_app.config["ORCHEST_API_ADDRESS"] + "/api/snapshots",
        json=snapshot_spec,
    )
    if resp.status_code != 201:
        remove_job_directory(job_uuid, pipeline_uuid, project_uuid)
        raise error.OrchestApiRequestError(response=resp)
    return resp.json()["uuid"]


def _move_job_directory(
    job_uuid: str, old_pipeline_uuid: str, new_pipeline_uuid: str, project_uuid: str
) -> str:
    """Moves a job directory to account for a pipeline change.


    Raises:
        UnexpectedFileSystemState: if the destination directory already
        exists.
        OSError: If the move operation failed.

    """
    if old_pipeline_uuid == new_pipeline_uuid:
        return

    old_path = utils.get_job_directory(old_pipeline_uuid, project_uuid, job_uuid)
    new_path = utils.get_job_directory(new_pipeline_uuid, project_uuid, job_uuid)

    if os.path.exists(new_path):
        raise error.UnexpectedFileSystemState(f"Directory {new_path} already exists.")

    # The pipeline directory might not exist.
    os.makedirs(os.path.split(new_path)[0], exist_ok=True)

    exit_code = subprocess.call(["mv", old_path, new_path], stderr=subprocess.STDOUT)
    if exit_code != 0:
        raise OSError(f"Failed to mv {old_path} to {new_path}, :{exit_code}.")


def change_draft_job_pipeline(
    job_uuid: str,
    new_pipeline_uuid: str,
) -> requests.Response:

    resp = requests.get(f"http://{config.ORCHEST_API_ADDRESS}/api/jobs/{job_uuid}")
    if resp.status_code != 200:
        return resp

    job = resp.json()
    old_pipeline_uuid = job["pipeline_uuid"]
    project_uuid = job["project_uuid"]

    # This is to avoid race conditions. The orchest-webserver db doesnt'
    # have a concept of jobs so we can't lock on the job and we can't
    # lock on the pipeline because the pipeline in the job snapshot
    # might not exist anymore in the webserver.
    Project.query.with_for_update().filter(Project.uuid == project_uuid)

    resp = requests.put(
        f"http://{config.ORCHEST_API_ADDRESS}/api/jobs/{job_uuid}/pipeline",
        json={"pipeline_uuid": new_pipeline_uuid},
    )

    if resp.status_code != 200:
        return resp

    try:
        _move_job_directory(
            job_uuid, old_pipeline_uuid, new_pipeline_uuid, project_uuid
        )
    except Exception as e:
        current_app.logger.error(
            "Failed to move the job directory, reverting job pipeline change."
        )
        current_app.logger.error(e)
        resp = requests.put(
            f"http://{config.ORCHEST_API_ADDRESS}/api/jobs/{job_uuid}/pipeline",
            json={"pipeline_uuid": old_pipeline_uuid},
        )
        if resp.status_code != 200:
            current_app.logger.error(
                (
                    "Failed to revert the job pipeline change.\n"
                    f"{resp.status_code}: {resp.text}"
                )
            )
        raise e

    return resp
