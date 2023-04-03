import os

ORCHEST_NAMESPACE = os.environ.get("ORCHEST_NAMESPACE")
ORCHEST_CLUSTER = os.environ.get("ORCHEST_CLUSTER")

ORCHEST_MAINTAINER_LABEL = "Orchest B.V. https://www.orchest.io"

# Orchest directories that need to exist in the userdir.
USERDIR_DATA = "/userdir/data"
USERDIR_JOBS = "/userdir/jobs"
USERDIR_PROJECTS = "/userdir/projects"
USERDIR_ENV_IMG_BUILDS = "/userdir/.orchest/env-img-builds"
USERDIR_JUPYTER_IMG_BUILDS = "/userdir/.orchest/jupyter-img-builds"
USERDIR_JUPYTERLAB = "/userdir/.orchest/user-configurations/jupyterlab"

ALLOWED_FILE_EXTENSIONS = ["ipynb", "py", "R", "sh", "jl", "js"]

POSTHOG_API_KEY = "c3l6aU4waEhweEhBQnQ0UHRyT0FxRm1iX25wLXYwanRDNElIanZCZ1pwMA=="
POSTHOG_HOST = "https://analytics.orchest.io"

ORCHEST_VERSION = os.environ.get("ORCHEST_VERSION")

DATA_DIR = "/data"
PROJECT_DIR = "/project-dir"
PIPELINE_FILE = "/pipeline.json"
PIPELINE_PARAMETERS_RESERVED_KEY = "pipeline_parameters"
FLASK_ENV = os.environ.get("FLASK_ENV")
CLOUD = os.environ.get("CLOUD") == "True"
ORCHEST_FQDN = os.environ.get("ORCHEST_FQDN")
GPU_ENABLED_INSTANCE = os.environ.get("ORCHEST_GPU_ENABLED_INSTANCE") == "True"
# This represents a container priority w.r.t. CPU time. By default, the
# container runtime (e.g. Docker) gives containers a value of 1024m.
# User code/containers such as steps, services, kernels, environment
# builds are made to run with a lower value so that in conditions of
# high cpu contention core Orchest services have priority, which helps
# in being responsive under high load. This is only enforced when CPU
# cycles are constrained. For more information, see the k8s docs about
# CPU SHARES.
USER_CONTAINERS_CPU_SHARES = "1m"
REGISTRY = "docker-registry"
# NOTE: The DNS resolver will not treat this as an FQDN perse (depending
# on the value of `ndots` in `/etc/resolv.conf` which by default is 5).
# Thus the `search` directive will be iterated to resolve the domain.
# This isn't an issue but results in unnecessary DNS queries.
# Why the default value of `ndots` is set to 5 in Kubernetes:
# https://github.com/kubernetes/kubernetes/issues/33554#issuecomment-266251056
REGISTRY_FQDN = f"docker-registry.{ORCHEST_NAMESPACE}.svc.cluster.local"

# Kubernetes distribution Orchest is running on.
K8S_DISTRO = os.environ.get("K8S_DISTRO")

# Container Runtime configs.
CONTAINER_RUNTIME = os.environ.get("CONTAINER_RUNTIME")
CONTAINER_RUNTIME_IMAGE = os.environ.get("CONTAINER_RUNTIME_IMAGE")
CONTAINER_RUNTIME_SOCKET = os.environ.get("CONTAINER_RUNTIME_SOCKET")
ARGO_EXECUTOR_IMAGE = "quay.io/argoproj/argoexec:v3.2.6"

# Ingress configs
INGRESS_CLASS = os.environ.get("INGRESS_CLASS", "nginx")

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
# Orchest environments that are passed as services, i.e. the image will
# be used to start a service, have a form of "environment@<env-uuid>".
ENVIRONMENT_AS_SERVICE_PREFIX = "environment@"
ENVIRONMENT_SHELL_SUFFIX_UUID_LENGTH = 6

# Kernels
KERNEL_NAME = "orchest-kernel-{environment_uuid}"

# Containers
PIPELINE_STEP_CONTAINER_NAME = "orchest-step-{run_uuid}-{step_uuid}"
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
ORCHEST_SOCKETIO_ENV_IMG_BUILDING_NAMESPACE = "/environment_image_builds"
ORCHEST_SOCKETIO_JUPYTER_IMG_BUILDING_NAMESPACE = "/jupyter_image_builds"


ENV_SETUP_SCRIPT_FILE_NAME = "setup_script.sh"

DEFAULT_SETUP_SCRIPT = """#!/bin/bash

# Install any dependencies you have in this shell script,
# see https://docs.orchest.io/en/latest/fundamentals/environments.html#install-packages

# E.g. mamba install -y tensorflow

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

SIDECAR_PORT = 1111

ORCHEST_UPDATE_INFO_URL = "https://api.github.com/repos/orchest/orchest/releases/latest"
