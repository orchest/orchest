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

from app.models import Pipeline, Project, Environment
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
    """Returns path to pipeline description file (including .orchest)"""

    USER_DIR = StaticConfig.USER_DIR
    if host_path == True:
        USER_DIR = StaticConfig.HOST_USER_DIR

    if pipeline_path is None:
        pipeline_path = pipeline_uuid_to_path(pipeline_uuid, project_uuid)

    project_path = project_uuid_to_path(project_uuid)

    if pipeline_run_uuid is None:
        return os.path.join(USER_DIR, "projects", project_path, pipeline_path)
    elif pipeline_run_uuid is not None and experiment_uuid is not None:
        return os.path.join(
            USER_DIR,
            "experiments",
            project_uuid,
            pipeline_uuid,
            experiment_uuid,
            pipeline_run_uuid,
            pipeline_path,
        )
    elif experiment_uuid is not None:
        return os.path.join(
            USER_DIR,
            "experiments",
            project_uuid,
            pipeline_uuid,
            experiment_uuid,
            "snapshot",
            pipeline_path,
        )


def get_pipeline_directory(
    pipeline_uuid,
    project_uuid,
    experiment_uuid=None,
    pipeline_run_uuid=None,
    host_path=False,
):
    """Returns path to directory CONTAINING the pipeline description file."""

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
def get_environments(project_uuid, language=None):

    environments = []
    project_dir = get_project_directory(project_uuid)
    environments_dir = os.path.join(project_dir, ".orchest", "environments")

    try:
        for path in os.listdir(environments_dir):

            environment_dir = os.path.join(environments_dir, path)

            if os.path.isdir(environment_dir):
                env = read_environment_from_disk(environment_dir, project_uuid)

                if language is None:
                    environments.append(env)
                else:
                    if language == env.language:
                        environments.append(env)
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
            "Could not environment from env_directory %s. Error: %s"
            % (env_directory, e)
        )


# End of environments


def get_hash(path):
    BLOCKSIZE = 8192 * 8
    hasher = hashlib.md5()
    with open(path, "rb") as afile:
        buf = afile.read(BLOCKSIZE)
        while len(buf) > 0:
            hasher.update(buf)
            buf = afile.read(BLOCKSIZE)

    return hasher.hexdigest()


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


def tar_from_path(path, filename):

    tmp_file_path = os.path.join("/tmp", str(uuid.uuid4()))
    tar = tarfile.open(tmp_file_path, "x")

    with open(path, "rb") as f:

        info = tarfile.TarInfo(filename)

        f.seek(0, io.SEEK_END)
        info.size = f.tell()
        f.seek(0, io.SEEK_SET)

        tar.addfile(info, f)
        tar.close()

    with open(tmp_file_path, "rb") as in_file:
        data = in_file.read()

    # remove tmp file
    os.remove(tmp_file_path)

    return data


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


def pipeline_uuid_to_path(pipeline_uuid, project_uuid):
    pipeline = (
        Pipeline.query.filter(Pipeline.uuid == pipeline_uuid)
        .filter(Pipeline.project_uuid == project_uuid)
        .first()
    )
    if pipeline is not None:
        return pipeline.path
    else:
        return None


def project_uuid_to_path(project_uuid):
    project = Project.query.filter(Project.uuid == project_uuid).first()
    if project is not None:
        return project.path
    else:
        return None


def name_to_tag(name):

    name = str(name).lower()

    # lowercase is enforced because of Jupyter kernel names automatically
    # becoming lowercase

    # According to Docker's website:
    # A tag name must be valid ASCII and
    # may contain lowercase and
    # uppercase letters, digits, underscores, periods and dashes.
    # A tag name may not start with a period or a dash and
    # may contain a maximum of 128 characters.

    # replace all spaces by dashes
    name = name.replace(" ", "-")

    allowed_symbols = set(
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.-"
    )

    name = "".join([char if char in allowed_symbols else "-" for char in list(name)])

    while len(name) > 0 and name[0] in set(".-"):
        name = name[1:]

    return name[0:128]


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
