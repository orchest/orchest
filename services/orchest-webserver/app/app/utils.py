import collections
import hashlib
import json
import os
import re
import uuid
from datetime import datetime
from typing import Optional

import requests
from flask import current_app, safe_join

from _orchest.internals import config as _config
from _orchest.internals.utils import copytree, is_services_definition_valid, rmtree
from app.compat import migrate_pipeline
from app.config import CONFIG_CLASS as StaticConfig
from app.models import Environment, Pipeline, Project
from app.schemas import EnvironmentSchema


# Directory resolves
def get_pipeline_path(
    pipeline_uuid,
    project_uuid,
    job_uuid=None,
    pipeline_run_uuid=None,
    pipeline_path=None,
):
    """Returns path to pipeline definition file (including .orchest)"""

    USER_DIR = StaticConfig.USER_DIR

    if pipeline_path is None:
        pipeline_path = pipeline_uuid_to_path(pipeline_uuid, project_uuid, job_uuid)

    project_path = project_uuid_to_path(project_uuid)

    if pipeline_run_uuid is None and job_uuid is None:
        return safe_join(USER_DIR, "projects", project_path, pipeline_path)
    elif pipeline_run_uuid is not None and job_uuid is not None:
        return safe_join(
            get_job_directory(pipeline_uuid, project_uuid, job_uuid),
            pipeline_run_uuid,
            pipeline_path,
        )
    elif job_uuid is not None:
        return safe_join(
            get_job_directory(pipeline_uuid, project_uuid, job_uuid),
            "snapshot",
            pipeline_path,
        )


def get_job_directory(pipeline_uuid, project_uuid, job_uuid):
    """Job directory contains:
    snapshot/
    <pipeline_run_uuid>/<project copy>
    """

    USER_DIR = StaticConfig.USER_DIR

    return safe_join(USER_DIR, "jobs", project_uuid, pipeline_uuid, job_uuid)


def get_pipeline_directory(
    pipeline_uuid,
    project_uuid,
    job_uuid=None,
    pipeline_run_uuid=None,
):
    """Returns path to directory with the pipeline definition file."""

    return os.path.split(
        get_pipeline_path(
            pipeline_uuid,
            project_uuid,
            job_uuid,
            pipeline_run_uuid,
        )
    )[0]


def get_project_directory(project_uuid):
    USER_DIR = StaticConfig.USER_DIR

    return safe_join(USER_DIR, "projects", project_uuid_to_path(project_uuid))


def get_project_snapshot_size(project_uuid):
    """Returns the snapshot size for a project in MB."""

    def get_size(path, skip_dirs):
        size = 0
        for root, dirs, files in os.walk(path):
            size += sum(os.path.getsize(safe_join(root, name)) for name in files)

            for skip_dir in skip_dirs:
                if skip_dir in dirs:
                    dirs.remove(skip_dir)

        return size

    project_dir = get_project_directory(project_uuid)

    # This does not count towards size for snapshots.
    # NOTE: For optimization purposes we might have to also ignore the
    # `.git` directories. Although for large `.git` directories the
    # approximation would be significantly different from the exact
    # value.
    skip_dirs = [".orchest"]

    # Convert bytes to megabytes.
    return get_size(project_dir, skip_dirs) / (1024 ** 2)


def project_exists(project_uuid):
    return Project.query.filter(
        Project.uuid == project_uuid
    ).count() == 0 or not os.path.isdir(get_project_directory(project_uuid))


def get_environment_directory(environment_uuid, project_uuid):
    return safe_join(
        get_project_directory(project_uuid),
        ".orchest",
        "environments",
        environment_uuid,
    )


# End of directory resolves

# Environments
def get_environment(environment_uuid, project_uuid):
    environment_dir = get_environment_directory(environment_uuid, project_uuid)
    return read_environment_from_disk(environment_dir, project_uuid)


def get_environments(project_uuid, language=None):

    environments = []
    project_dir = get_project_directory(project_uuid)
    environments_dir = safe_join(project_dir, ".orchest", "environments")

    try:
        for path in os.listdir(environments_dir):

            environment_dir = safe_join(environments_dir, path)

            if os.path.isdir(environment_dir):
                env = read_environment_from_disk(environment_dir, project_uuid)

                # read_environment_from_disk is not guaranteed to
                # succeed on failure it returns None, and logs the error
                # .
                if env is not None:
                    if language is None:
                        environments.append(env)
                    else:
                        if language == env.language:
                            environments.append(env)
                else:
                    current_app.logger.info(
                        "Could not read environment for env dir %s and project_uuid %s"
                        % (environment_dir, project_uuid)
                    )
    except FileNotFoundError:
        current_app.logger.error(
            "Could not find environments directory in project path %s"
            % environments_dir
        )
    except Exception as e:
        current_app.logger.error(e)

    return environments


def preprocess_script(script):
    """
    This preprocesses bash scripts
    that come from the client.

    Make sure it only contains UNIX style line endings to make
    sure the script can run without issues.
    """
    return script.replace("\r\n", "\n")


def serialize_environment_to_disk(environment, env_directory):

    environment_schema = EnvironmentSchema()

    # treat setup_script separately
    with open(safe_join(env_directory, "properties.json"), "w") as file:

        environmentDICT = environment_schema.dump(environment)

        # don't serialize project_uuid
        del environmentDICT["project_uuid"]
        # setup scripts is serialized separately
        del environmentDICT["setup_script"]

        file.write(json.dumps(environmentDICT))

    # write setup_script
    with open(
        safe_join(env_directory, _config.ENV_SETUP_SCRIPT_FILE_NAME), "w"
    ) as file:
        file.write(environment.setup_script)


def read_environment_from_disk(env_directory, project_uuid) -> Optional[Environment]:

    try:
        with open(safe_join(env_directory, "properties.json"), "r") as file:
            env_dat = json.load(file)

        with open(
            safe_join(env_directory, _config.ENV_SETUP_SCRIPT_FILE_NAME), "r"
        ) as file:
            setup_script = file.read()

        e = Environment(**env_dat)
        e.project_uuid = project_uuid
        e.setup_script = setup_script

        return e
    except Exception as e:
        current_app.logger.error(
            "Could not get environment from env_directory %s. Error: %s"
            % (env_directory, e)
        )


def delete_environment(app, project_uuid, environment_uuid):
    """Delete an environment from disk and from the runtime environment

    Args:
        project_uuid:
        environment_uuid:

    Returns:

    """
    url = (
        f"http://{app.config['ORCHEST_API_ADDRESS']}"
        f"/api/environments/{project_uuid}/{environment_uuid}"
    )
    app.config["SCHEDULER"].add_job(requests.delete, args=[url])

    environment_dir = get_environment_directory(environment_uuid, project_uuid)
    rmtree(environment_dir)


def populate_default_environments(project_uuid):

    for env_spec in current_app.config["DEFAULT_ENVIRONMENTS"]:
        e = Environment(**env_spec)

        e.uuid = str(uuid.uuid4())
        e.project_uuid = project_uuid

        environment_dir = get_environment_directory(e.uuid, project_uuid)
        os.makedirs(environment_dir, exist_ok=True)

        serialize_environment_to_disk(e, environment_dir)


# End of environments


def get_environments_from_pipeline_json(pipeline_definition):
    environment_uuids = set()

    for _, step in enumerate(pipeline_definition["steps"]):
        environment_uuids.add(pipeline_definition["steps"].get(step).get("environment"))

    return environment_uuids


def get_pipeline_json(pipeline_uuid, project_uuid):
    pipeline_path = get_pipeline_path(pipeline_uuid, project_uuid)

    try:
        with open(pipeline_path, "r") as json_file:
            pipeline_json = json.load(json_file)

            # Apply pipeline migrations
            migrate_pipeline(pipeline_json)

            return pipeline_json
    except Exception as e:
        current_app.logger.error("Could not read pipeline JSON from %s" % e)


def get_hash(path):
    BLOCKSIZE = 8192 * 8
    hasher = hashlib.md5()
    with open(path, "rb") as afile:
        buf = afile.read(BLOCKSIZE)
        while len(buf) > 0:
            hasher.update(buf)
            buf = afile.read(BLOCKSIZE)

    return hasher.hexdigest()


def get_repo_tag():
    return os.getenv("ORCHEST_VERSION")


def clear_folder(folder):
    try:
        for filename in os.listdir(folder):
            file_path = safe_join(folder, filename)
            try:
                if os.path.isfile(file_path) or os.path.islink(file_path):
                    os.unlink(file_path)
                elif os.path.isdir(file_path):
                    rmtree(file_path)
            except Exception as e:
                current_app.logger.error(
                    "Failed to delete %s. Reason: %s" % (file_path, e)
                )
    except FileNotFoundError as e:
        current_app.logger.error("Failed to delete %s. Reason: %s" % (folder, e))


def remove_dir_if_empty(path):
    if os.path.isdir(path) and not any(True for _ in os.scandir(path)):
        rmtree(path, ignore_errors=True)


def pipeline_uuid_to_path(pipeline_uuid, project_uuid, job_uuid=None):
    if job_uuid is None:
        pipeline = (
            Pipeline.query.filter(Pipeline.uuid == pipeline_uuid)
            .filter(Pipeline.project_uuid == project_uuid)
            .first()
        )
        if pipeline is not None:
            return pipeline.path
        else:
            return None
    else:
        resp = requests.get(
            f'http://{current_app.config["ORCHEST_API_ADDRESS"]}/api/jobs/{job_uuid}',
        )
        data = resp.json()

        if resp.status_code == 200:
            # Return None if neither is not found.
            return (
                data.get("pipeline_run_spec", {})
                .get("run_config", {})
                .get("pipeline_path")
            )
        else:
            return None


def project_entity_counts(project_uuid, get_job_count=False, get_session_count=False):

    counts = {}

    counts["pipeline_count"] = Pipeline.query.filter(
        Pipeline.project_uuid == project_uuid
    ).count()

    counts["environment_count"] = len(get_environments(project_uuid))

    if get_job_count:
        counts["job_count"] = get_api_entity_counts(
            "/api/jobs/", "jobs", project_uuid
        ).get(project_uuid, 0)

    if get_session_count:
        counts["session_count"] = get_api_entity_counts(
            "/api/sessions/", "sessions", project_uuid
        ).get(project_uuid, 0)

    return counts


def get_job_counts():
    return get_api_entity_counts("/api/jobs/", "jobs")


def get_session_counts():
    return get_api_entity_counts("/api/sessions/", "sessions")


def get_api_entity_counts(endpoint, entity_key, project_uuid=None):
    params = {}
    if project_uuid is not None:
        params["project_uuid"] = project_uuid

    resp = requests.get(
        f'http://{current_app.config["ORCHEST_API_ADDRESS"]}{endpoint}', params=params
    )

    if resp.status_code != 200:
        current_app.logger.error(
            "Failed to fetch entity count "
            "from orchest-api. Endpoint [%s] Entity key[%s]. Status code: %d"
            % (endpoint, entity_key, resp.status_code)
        )
        return {}

    data = resp.json()
    counts = collections.defaultdict(int)
    for entity in data[entity_key]:
        counts[entity["project_uuid"]] += 1

    return counts


def project_uuid_to_path(project_uuid: str) -> Optional[str]:
    project = Project.query.filter(Project.uuid == project_uuid).first()
    if project is not None:
        return project.path
    else:
        return None


def find_pipelines_in_dir(path, relative_to=None):

    ignore_dirs = [".ipynb_checkpoints"]

    pipelines = []

    if os.path.isdir(path):
        for root, dirs, files in os.walk(path):

            dirs[:] = [d for d in dirs if d not in ignore_dirs]

            for fName in files:
                if fName.endswith(".orchest"):
                    if relative_to is not None:
                        root = root[len(relative_to) :]
                        if root.startswith("/"):
                            root = root[1:]

                    # Path normalization is important for correctly
                    # detecting pipelines that were deleted through the
                    # file system in SyncProjectPipelinesDBState, i.e.
                    # to avoid false positives.
                    pipelines.append(os.path.normpath(safe_join(root, fName)))

    return pipelines


def write_config(app, key, value):

    try:
        conf_json_path = "/config/config.json"

        if not os.path.isfile(conf_json_path):
            os.system("touch " + conf_json_path)

        with open(conf_json_path, "r") as f:
            try:
                conf_data = json.load(f)
            except Exception as e:
                print("JSON read error: %s" % e)
                conf_data = {}

            conf_data[key] = value

            app.config.update(conf_data)
        with open(conf_json_path, "w") as f:
            try:
                json.dump(conf_data, f)
            except Exception as e:
                current_app.logger.debug(e)
    except Exception as e:
        current_app.logger.debug(e)

    # always set rw permissions on file
    os.system("chmod o+rw " + conf_json_path)


def create_job_directory(job_uuid, pipeline_uuid, project_uuid):

    snapshot_path = safe_join(
        get_job_directory(pipeline_uuid, project_uuid, job_uuid),
        "snapshot",
    )

    os.makedirs(os.path.split(snapshot_path)[0], exist_ok=True)

    project_dir = safe_join(
        current_app.config["USER_DIR"], "projects", project_uuid_to_path(project_uuid)
    )

    copytree(project_dir, snapshot_path, use_gitignore=True)


def remove_job_directory(job_uuid, pipeline_uuid, project_uuid):

    job_project_path = safe_join(current_app.config["USER_DIR"], "jobs", project_uuid)
    job_pipeline_path = safe_join(job_project_path, pipeline_uuid)
    job_path = safe_join(job_pipeline_path, job_uuid)

    if os.path.isdir(job_path):
        rmtree(job_path, ignore_errors=True)

    # Clean up parent directory if this job removal created empty
    # directories.
    remove_dir_if_empty(job_pipeline_path)
    remove_dir_if_empty(job_project_path)


def remove_job_pipeline_run_directory(run_uuid, job_uuid, pipeline_uuid, project_uuid):

    job_project_path = safe_join(current_app.config["USER_DIR"], "jobs", project_uuid)
    job_pipeline_path = safe_join(job_project_path, pipeline_uuid)
    job_path = safe_join(job_pipeline_path, job_uuid)
    job_pipeline_run_path = safe_join(job_path, run_uuid)

    if os.path.isdir(job_pipeline_run_path):
        rmtree(job_pipeline_run_path, ignore_errors=True)


def remove_project_jobs_directories(project_uuid):

    project_jobs_path = safe_join(current_app.config["USER_DIR"], "jobs", project_uuid)

    if os.path.isdir(project_jobs_path):
        rmtree(project_jobs_path, ignore_errors=True)


def get_ipynb_template(language: str):

    language_to_template = {
        "python": "ipynb_template.json",
        "julia": "ipynb_template_julia.json",
        "r": "ipynb_template_r.json",
    }

    if language not in language_to_template.keys():
        language = "python"

    template_json = json.load(
        open(
            safe_join(
                current_app.config["RESOURCE_DIR"], language_to_template[language]
            ),
            "r",
        )
    )
    return template_json


def generate_ipynb_from_template(kernel_name: str):

    template_json = get_ipynb_template(kernel_name)

    return json.dumps(template_json, indent=4)


def create_empty_file(file_path: str, kernel_name: Optional[str] = "python"):
    """
    This function creates an empty file with the given `file_path`.
    `kernel_name` is optional. It is  only applicable if `file_path`
    ends with `.ipynb`.

    Note: this function does not update pipeline JSON file. Therefore it
    does not assume that step['file_path'] holds the value of
    `file_path`.
    """

    file_path_split = file_path.split(".")
    file_path_without_ext = ".".join(file_path_split[:-1])
    ext = file_path_split[-1]

    file_content = None

    if not os.path.isfile(file_path):

        if len(file_path_without_ext) > 0:
            file_content = ""

        if ext == "ipynb":
            file_content = generate_ipynb_from_template(kernel_name)

    elif ext == "ipynb":
        # Check for empty .ipynb, for which we also generate a
        # template notebook.
        if os.stat(file_path).st_size == 0:
            file_content = generate_ipynb_from_template(kernel_name)

    if file_content is not None:
        with open(file_path, "w") as file:
            file.write(file_content)


def request_args_to_string(args):
    if args is None or len(args) == 0:
        return ""
    return "?" + "&".join([key + "=" + value for key, value in args.items()])


def generate_gateway_kernel_name(environment_uuid):

    return _config.KERNEL_NAME.format(environment_uuid=environment_uuid)


def pipeline_set_notebook_kernels(pipeline_json, pipeline_directory, project_uuid):
    """

    Raises:
        KeyError: The structure of the metadata in thee Notebook's JSON
            was changed.

    """
    # for each step set correct notebook kernel if it exists

    steps = pipeline_json["steps"].keys()

    for key in steps:
        step = pipeline_json["steps"][key]

        if "ipynb" == step["file_path"].split(".")[-1]:

            notebook_path = safe_join(pipeline_directory, step["file_path"])

            if os.path.isfile(notebook_path):

                with open(notebook_path, "r") as file:
                    notebook_json = json.load(file)

                notebook_changed = False

                # Set language info and kernelspec.language metadata.
                language = step["kernel"]["name"]
                if notebook_json["metadata"]["kernelspec"]["language"] != language:
                    notebook_changed = True
                    notebook_json["metadata"]["kernelspec"]["language"] = language
                    template_json = get_ipynb_template(language.lower())
                    notebook_json["metadata"]["language_info"] = template_json[
                        "metadata"
                    ]["language_info"]

                # Set kernel name (orchest-kernel-<uuid>) and display
                # name (name of the environment).
                environment_uuid = step.get("environment")
                if environment_uuid is None or environment_uuid == "":
                    notebook_changed = True
                    notebook_json["metadata"]["kernelspec"]["name"] = ""
                    notebook_json["metadata"]["kernelspec"]["display_name"] = ""
                else:
                    gateway_kernel = generate_gateway_kernel_name(step["environment"])
                    if (
                        notebook_json["metadata"]["kernelspec"]["name"]
                        != gateway_kernel
                    ):
                        notebook_changed = True
                        notebook_json["metadata"]["kernelspec"]["name"] = gateway_kernel

                    environment = get_environment(step["environment"], project_uuid)
                    if environment is not None:
                        if (
                            notebook_json["metadata"]["kernelspec"]["display_name"]
                            != environment.name
                        ):
                            notebook_changed = True
                            notebook_json["metadata"]["kernelspec"][
                                "display_name"
                            ] = environment.name
                    else:
                        notebook_changed = True
                        notebook_json["metadata"]["kernelspec"]["display_name"] = ""
                        current_app.logger.warn(
                            (
                                "Could not find environment [%s] while setting"
                                "notebook kernelspec for notebook %s."
                            )
                            % (step["environment"], notebook_path)
                        )

                if notebook_changed:
                    with open(notebook_path, "w") as f:
                        json.dump(notebook_json, f, indent=4)

            else:
                current_app.logger.info(
                    (
                        "pipeline_set_notebook_kernels called on notebook_path "
                        "that doesn't exist %s"
                    )
                    % notebook_path
                )


def check_pipeline_correctness(pipeline_json):
    invalid_entries = {}

    mem_size = pipeline_json["settings"].get("data_passing_memory_size")
    if mem_size is None:
        invalid_entries["data_passing_memory_size"] = "missing"
    elif (not isinstance(mem_size, str)) or (
        re.match(r"^\d+(\.\d+)?\s*(KB|MB|GB)$", mem_size) is None
    ):
        invalid_entries["data_passing_memory_size"] = "invalid_value"

    if not is_services_definition_valid(pipeline_json.get("services", {})):
        invalid_entries["services"] = "invalid_value"

    return invalid_entries


def has_active_sessions(project_uuid: str, pipeline_uuid=None):
    args = {"project_uuid": project_uuid}
    if pipeline_uuid is not None:
        args["pipeline_uuid"] = pipeline_uuid
    resp = requests.get(
        f"http://{_config.ORCHEST_API_ADDRESS}/api/sessions/"
        + request_args_to_string(args),
    )
    return bool(resp.json()["sessions"])


def normalize_project_relative_path(path: str) -> str:
    # https://stackoverflow.com/questions/52260324/why-os-path-normpath-does-not-remove-the-firsts
    while path.startswith("/"):
        path = path[1:]
    return os.path.normpath(path)


def is_valid_project_relative_path(project_uuid, path: str) -> str:
    project_path = os.path.abspath(
        os.path.normpath(get_project_directory(project_uuid))
    )
    new_path_abs = os.path.abspath(
        os.path.normpath(
            os.path.join(
                get_project_directory(project_uuid),
                normalize_project_relative_path(path),
            )
        )
    )
    return new_path_abs.startswith(project_path)


def resolve_absolute_path(abs_path: str) -> Optional[str]:
    """Resolves an absolute path to the FS-layout of the webserver.

    Note:
        Currently only /data is supported.
    """
    prefix_map = {"/data": _config.USERDIR_DATA}

    for prefix, fs_prefix in prefix_map.items():
        if abs_path.startswith(prefix):
            matched_prefix = prefix
            resolved_prefix = fs_prefix
            break
    else:
        return

    file_path = abs_path[len(matched_prefix) :]
    return resolved_prefix + file_path


_DEFAULT_ORCHEST_EXAMPLES_JSON = {
    "creation_time": datetime.utcnow().isoformat(),
    "entries": [],
}


def get_orchest_examples_json() -> dict:
    """Get orchest examples references, ordered by stars."""

    path = current_app.config["ORCHEST_EXAMPLES_JSON_PATH"]
    if not os.path.exists(path):
        current_app.logger.warning("Could not find public examples json.")
        return _DEFAULT_ORCHEST_EXAMPLES_JSON
    else:
        with open(current_app.config["ORCHEST_EXAMPLES_JSON_PATH"]) as f:
            data = json.load(f)
            if "creation_time" not in data or "entries" not in data:
                current_app.logger.error(f"Malformed public examples json : {data}.")
                return _DEFAULT_ORCHEST_EXAMPLES_JSON
            data["entries"].sort(key=lambda x: -x.get("stargazers_count", -1))
            return data


_DEFAULT_ORCHEST_UPDATE_INFO_JSON = {"latest_version": None}


def get_orchest_update_info_json() -> dict:
    """Get orchest update info.

    Returns:
        A dictionary mapping latest_version to the latest Orchest
        version.
    """

    path = current_app.config["ORCHEST_UPDATE_INFO_JSON_PATH"]
    if not os.path.exists(path):
        current_app.logger.warning("Could not find orchest update info json.")
        return _DEFAULT_ORCHEST_UPDATE_INFO_JSON
    else:
        with open(current_app.config["ORCHEST_UPDATE_INFO_JSON_PATH"]) as f:
            data = json.load(f)
            if not isinstance(data.get("latest_version"), str):
                current_app.logger.error(
                    f"Malformed orchest update info json : {data}."
                )
                return _DEFAULT_ORCHEST_EXAMPLES_JSON
            return data
