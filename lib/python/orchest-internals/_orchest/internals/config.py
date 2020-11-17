import os

# TODO: add notice that some of these values have effect on the sdk!.

# General.
TEMP_DIRECTORY_PATH = "/tmp/orchest"
TEMP_VOLUME_NAME = "tmp-orchest-{uuid}-{project_uuid}"
PROJECT_DIR = "/project-dir"

# Relative to the `userdir` path.
KERNELSPECS_PATH = ".orchest/kernels/{project_uuid}"

# Environments
ENVIRONMENT_IMAGE_NAME = "orchest-env-{project_uuid}-{environment_uuid}"

# Containers
PIPELINE_STEP_CONTAINER_NAME = "orchest-step-{run_uuid}-{step_uuid}"

# Relative to the `project_dir` path.
LOGS_PATH = ".orchest/{pipeline_uuid}/logs"

WEBSERVER_LOGS = "/orchest/services/orchest-webserver/app/orchest-webserver.log"
DOCS_ROOT = "https://orchest.readthedocs.io"

# Networking
ORCHEST_API_ADDRESS = "orchest-api"
ORCHEST_SOCKETIO_SERVER_ADDRESS = "http://orchest-webserver"
ORCHEST_SOCKETIO_ENV_BUILDING_NAMESPACE = "/environment_builds"


ENV_SETUP_SCRIPT_PROPERTY_NAME = "setup_script"
ENV_SETUP_SCRIPT_FILE_NAME = f"{ENV_SETUP_SCRIPT_PROPERTY_NAME}.sh"
# Environments
# These environments are added when you create a new project
DEFAULT_ENVIRONMENTS = [
    {
        "name": "custom-base-kernel-py",
        "base_image": "orchest/custom-base-kernel-py",
        "language": "python",
        ENV_SETUP_SCRIPT_PROPERTY_NAME: "",
        "gpu_support": False,
    },
    {
        "name": "custom-base-kernel-r",
        "base_image": "orchest/custom-base-kernel-r",
        "language": "r",
        ENV_SETUP_SCRIPT_PROPERTY_NAME: "",
        "gpu_support": False,
    },
]

DEFAULT_DATASOURCES = [
    {
        "name": "_default",
        "connection_details": {"absolute_host_path": "$HOST_USER_DIR/data"},
        "source_type": "host-directory",
    }
]

# memory-server
MEMORY_SERVER_SOCK_PATH = TEMP_DIRECTORY_PATH
