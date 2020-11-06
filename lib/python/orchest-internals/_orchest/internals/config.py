import os

# TODO: add notice that some of these values have effect on the sdk!.

# General.
TEMP_DIRECTORY_PATH = "/tmp/orchest"
TEMP_VOLUME_NAME = "tmp-orchest-{uuid}-{project_uuid}"
PROJECT_DIR = "/project-dir"

# Relative to the `userdir` path.
KERNELSPECS_PATH = ".orchest/kernels"

# Relative to the `project_dir` path.
LOGS_PATH = ".orchest/{pipeline_uuid}/logs"

WEBSERVER_LOGS = "/orchest/services/orchest-webserver/app/orchest-webserver.log"
DOCS_ROOT = "https://orchest.readthedocs.io"

# Networking
ORCHEST_API_ADDRESS = "orchest-api"
ORCHEST_SOCKETIO_SERVER_ADDRESS = "http://orchest-webserver:80"
ORCHEST_SOCKETIO_ENV_BUILDING_NAMESPACE = "/environment_builds"


# Images
DEFAULT_BASE_IMAGES = [
    {"name": "orchestsoftware/custom-base-kernel-py", "language": "python"},
    {"name": "orchestsoftware/custom-base-kernel-r", "language": "r"},
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
