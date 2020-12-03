import json
import os
import hashlib
import json
import random
import string
import logging
import uuid
import tarfile
import io
import docker
import shutil
import requests
import subprocess

from app.models import Pipeline, Project, Environment, Experiment
from app.config import CONFIG_CLASS as StaticConfig
from app.schemas import EnvironmentSchema
from _orchest.internals import config as _config

# Directory resolves
def get_pipeline_path(
    pipeline_uuid,
    project_uuid,
    experiment_uuid=None,
    pipeline_run_uuid=None,
    host_path=False,
    pipeline_path=None,
):
    """Returns path to pipeline definition file (including .orchest)"""

    USER_DIR = StaticConfig.USER_DIR
    if host_path == True:
        USER_DIR = StaticConfig.HOST_USER_DIR

    if pipeline_path is None:
        pipeline_path = pipeline_uuid_to_path(
            pipeline_uuid, project_uuid, experiment_uuid
        )

    project_path = project_uuid_to_path(project_uuid)

    if pipeline_run_uuid is None and experiment_uuid is None:
        return os.path.join(USER_DIR, "projects", project_path, pipeline_path)
    elif pipeline_run_uuid is not None and experiment_uuid is not None:
        return os.path.join(
            get_experiment_directory(
                pipeline_uuid, project_uuid, experiment_uuid, host_path
            ),
            pipeline_run_uuid,
            pipeline_path,
        )
    elif experiment_uuid is not None:
        return os.path.join(
            get_experiment_directory(
                pipeline_uuid, project_uuid, experiment_uuid, host_path
            ),
            "snapshot",
            pipeline_path,
        )


def get_experiment_directory(
    pipeline_uuid, project_uuid, experiment_uuid, host_path=False
):
    """Experiment directory contains:
    snapshot/
    <pipeline_run_uuid>/<project copy>
    """

    USER_DIR = StaticConfig.USER_DIR
    if host_path == True:
        USER_DIR = StaticConfig.HOST_USER_DIR

    return os.path.join(
        USER_DIR, "experiments", project_uuid, pipeline_uuid, experiment_uuid
    )


def get_pipeline_directory(
    pipeline_uuid,
    project_uuid,
    experiment_uuid=None,
    pipeline_run_uuid=None,
    host_path=False,
):
    """Returns path to directory CONTAINING the pipeline definition file."""

    return os.path.split(
        get_pipeline_path(
            pipeline_uuid,
            project_uuid,
            experiment_uuid,
            pipeline_run_uuid,
            host_path,
        )
    )[0]


def get_project_directory(project_uuid, host_path=False):
    USER_DIR = StaticConfig.USER_DIR
    if host_path == True:
        USER_DIR = StaticConfig.HOST_USER_DIR

    return os.path.join(USER_DIR, "projects", project_uuid_to_path(project_uuid))


def get_environment_directory(environment_uuid, project_uuid, host_path=False):
    return os.path.join(
        get_project_directory(project_uuid, host_path),
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
    environments_dir = os.path.join(project_dir, ".orchest", "environments")

    try:
        for path in os.listdir(environments_dir):

            environment_dir = os.path.join(environments_dir, path)

            if os.path.isdir(environment_dir):
                env = read_environment_from_disk(environment_dir, project_uuid)

                # read_environment_from_disk is not guaranteed to succeed
                # on failure it returns None, and logs the error.
                if env is not None:
                    if language is None:
                        environments.append(env)
                    else:
                        if language == env.language:
                            environments.append(env)
                else:
                    logging.info(
                        "Could not read environment for env dir %s and project_uuid %s"
                        % (environment_dir, project_uuid)
                    )
    except FileNotFoundError as e:
        logging.error(
            "Could not find environments directory in project path %s"
            % environments_dir
        )
    except Exception as e:
        logging.error(e)

    return environments


def serialize_environment_to_disk(environment, env_directory):

    environment_schema = EnvironmentSchema()

    # treat setup_script separately
    with open(os.path.join(env_directory, "properties.json"), "w") as file:

        environmentDICT = environment_schema.dump(environment)

        # don't serialize project_uuid
        del environmentDICT["project_uuid"]
        # setup scripts is serialized separately
        del environmentDICT["setup_script"]

        file.write(json.dumps(environmentDICT))

    # write setup_script
    with open(
        os.path.join(env_directory, _config.ENV_SETUP_SCRIPT_FILE_NAME), "w"
    ) as file:
        file.write(environment.setup_script)


def read_environment_from_disk(env_directory, project_uuid):

    try:
        with open(os.path.join(env_directory, "properties.json"), "r") as file:
            env_dat = json.load(file)

        with open(
            os.path.join(env_directory, _config.ENV_SETUP_SCRIPT_FILE_NAME), "r"
        ) as file:
            setup_script = file.read()

        e = Environment(**env_dat)
        e.project_uuid = project_uuid
        e.setup_script = setup_script

        return e
    except Exception as e:
        logging.error(
            "Could not get environment from env_directory %s. Error: %s"
            % (env_directory, e)
        )


def delete_environment(app, project_uuid, environment_uuid):
    """Delete an environment from disk and from the runtime environment (docker).

    Args:
        project_uuid:
        environment_uuid:

    Returns:

    """
    url = f"http://{app.config['ORCHEST_API_ADDRESS']}/api/environment-images/{project_uuid}/{environment_uuid}"
    app.config["SCHEDULER"].add_job(requests.delete, args=[url])

    environment_dir = get_environment_directory(environment_uuid, project_uuid)
    shutil.rmtree(environment_dir)


# End of environments


def get_pipeline_json(pipeline_uuid, project_uuid):
    pipeline_path = get_pipeline_path(pipeline_uuid, project_uuid)

    try:
        with open(pipeline_path, "r") as json_file:
            return json.load(json_file)
    except Exception as e:
        logging.error("Could not read pipeline JSON from %s" % e)


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

    git_proc = subprocess.Popen(
        'echo "$(git describe --abbrev=0 --tags) "',
        cwd="/orchest-host",
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    outs, _ = git_proc.communicate()

    return outs


def get_user_conf():
    conf_data = {}

    # configure default value
    conf_data["AUTH_ENABLED"] = False

    try:
        with open("/config/config.json", "r") as f:
            conf_data = json.load(f)
    except Exception as e:
        logging.debug(e)

    return conf_data


def get_user_conf_raw():
    try:
        with open("/config/config.json", "r") as f:
            return f.read()
    except Exception as e:
        logging.debug(e)


def save_user_conf_raw(config):
    try:
        with open("/config/config.json", "w") as f:
            f.write(config)
    except Exception as e:
        logging.debug(e)


def clear_folder(folder):
    for filename in os.listdir(folder):
        file_path = os.path.join(folder, filename)
        try:
            if os.path.isfile(file_path) or os.path.islink(file_path):
                os.unlink(file_path)
            elif os.path.isdir(file_path):
                shutil.rmtree(file_path)
        except Exception as e:
            print("Failed to delete %s. Reason: %s" % (file_path, e))


def remove_dir_if_empty(path):
    if os.path.isdir(path) and not os.listdir(path):
        shutil.rmtree(path)


def pipeline_uuid_to_path(pipeline_uuid, project_uuid, experiment_uuid=None):
    if experiment_uuid is None:
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
        experiment = Experiment.query.filter(Experiment.uuid == experiment_uuid).first()

        if experiment is not None:
            return experiment.pipeline_path
        else:
            return None


def project_uuid_to_path(project_uuid):
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

                    pipelines.append(os.path.join(root, fName))

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
                logging.debug(e)
    except Exception as e:
        logging.debug(e)

    # always set rw permissions on file
    os.system("chmod o+rw " + conf_json_path)
