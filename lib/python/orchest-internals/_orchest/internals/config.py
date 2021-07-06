import os

# TODO: add notice that some of these values have effect on the sdk!.

# General.
TEMP_DIRECTORY_PATH = "/tmp/orchest"
TEMP_VOLUME_NAME = "tmp-orchest-{uuid}-{project_uuid}"
PROJECT_DIR = "/project-dir"
PIPELINE_FILE = "/pipeline.json"
PIPELINE_PARAMETERS_RESERVED_KEY = "pipeline_parameters"
CLOUD = os.environ.get("CLOUD") == "true"

# Databases
database_naming_convention = {
    # The _N_, e.g. (column_0_N_label) is there so that the name will
    # contain all columns names, to avoid name collision with other
    # constraints.
    # https://docs.sqlalchemy.org/en/13/core/metadata.html#sqlalchemy.schema.MetaData.params.naming_convention
    "ix": "ix_%(column_0_N_label)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_N_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

# Relative to the `userdir` path.
KERNELSPECS_PATH = ".orchest/kernels/{project_uuid}"

# Environments
ENVIRONMENT_IMAGE_NAME = "orchest-env-{project_uuid}-{environment_uuid}"
# NOTE: the build_uuid is rather important, since it allows us to
# differentiate between builds of the same environment. Without that,
# different env builds would contend for the same tag (the same
# environment image removal name), leading to issues in the case of
# multiple environment images "versions" surviving through multiple
# updates because of jobs.
ENVIRONMENT_IMAGE_REMOVAL_NAME = (
    "removed-orchest-env-{project_uuid}-{environment_uuid}-{build_uuid}"
)

# Orchest environments that are passed as services, i.e. the image will
# be used to start a service, have a form of "environment@<env-uuid>".
ENVIRONMENT_AS_SERVICE_PREFIX = "environment@"

# Kernels
KERNEL_NAME = "orchest-kernel-{environment_uuid}"

# Containers
PIPELINE_STEP_CONTAINER_NAME = "orchest-step-{run_uuid}-{step_uuid}"
JUPYTER_SERVER_NAME = "jupyter-server-{project_uuid}-{pipeline_uuid}"
JUPYTER_EG_SERVER_NAME = "jupyter-EG-{project_uuid}-{pipeline_uuid}"
JUPYTER_USER_CONFIG = ".orchest/user-configurations/jupyterlab"
JUPYTER_SETUP_SCRIPT = f"{JUPYTER_USER_CONFIG}/setup_script.sh"
JUPYTER_IMAGE_NAME = "orchest-jupyter-server-user-configured"

# Whenever UUIDs take up too much space in an identifier the UUIDs are
# truncated to this length. This typically only happens when multiple
# UUIDs are concatenated. E.g. hostname length is limited to 63
# characters per label (parts enclosed in dots). We use a truncated
# length of 18 since for UUID v4 that means they don't end with a
# hyphen. Ending with a hyphen can be problematic as it's not allowed
# for hostnames.
TRUNCATED_UUID_LENGTH = 18

# Relative to the `project_dir` path.
LOGS_PATH = ".orchest/pipelines/{pipeline_uuid}/logs"

WEBSERVER_LOGS = "/orchest/services/orchest-webserver/app/orchest-webserver.log"

# Networking
ORCHEST_API_ADDRESS = "orchest-api"
ORCHEST_SOCKETIO_SERVER_ADDRESS = "http://orchest-webserver"
ORCHEST_SOCKETIO_ENV_BUILDING_NAMESPACE = "/environment_builds"
ORCHEST_SOCKETIO_JUPYTER_BUILDING_NAMESPACE = "/jupyter_builds"


ENV_SETUP_SCRIPT_FILE_NAME = "setup_script.sh"

DEFAULT_SETUP_SCRIPT = """#!/bin/bash

# Install any dependencies you have in this shell script.

# E.g. pip install tensorflow

"""

# Environments
# These environments are added when you create a new project
DEFAULT_ENVIRONMENTS = [
    {
        "name": "Python 3",
        "base_image": "orchest/base-kernel-py",
        "language": "python",
        "setup_script": DEFAULT_SETUP_SCRIPT,
        "gpu_support": False,
    },
]

DOCKER_NETWORK = "orchest"

# memory-server
MEMORY_SERVER_SOCK_PATH = TEMP_DIRECTORY_PATH

SIDECAR_PORT = 1111
