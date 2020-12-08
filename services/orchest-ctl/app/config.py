import os

from app.errors import ENVVariableNotFound


# Can either be "reg" or "dev"
RUN_MODE = "reg"
# Can either be "reg" or "web"
UPDATE_MODE = "reg"

DOCKER_NETWORK = "orchest"

# Configurations directly related to container specifications.
DURABLE_QUEUES_DIR = ".orchest/rabbitmq-mnesia"

# All the images that are used by Orchest.
_orchest_images = [
    "orchest/jupyter-enterprise-gateway:latest",
    "orchest/jupyter-server:latest",
    "orchest/memory-server:latest",
    "orchest/orchest-ctl:latest",
    "orchest/update-server:latest",
    "orchest/orchest-api:latest",
    "orchest/orchest-webserver:latest",
    "orchest/celery-worker:latest",
    "orchest/auth-server:latest",
    "orchest/file-manager:latest",
    "orchest/nginx-proxy:latest",
    "rabbitmq:3",
]
LANGUAGE_IMAGES = {
    "none": _orchest_images,
    "python": _orchest_images + ["orchest/base-kernel-py:latest"],
    "python-gpu": _orchest_images
    + ["orchest/base-kernel-py:latest" "orchest/base-kernel-py-gpu:latest"],
    "r": _orchest_images + ["orchest/base-kernel-r:latest"],
    "all": _orchest_images
    + [
        "orchest/base-kernel-py:latest",
        "orchest/base-kernel-r:latest",
    ],
    "all-gpu": _orchest_images
    + [
        "orchest/base-kernel-py:latest",
        "orchest/base-kernel-py-gpu:latest",
        "orchest/base-kernel-r:latest",
    ],
}

# Images to be run on start of Orchest.
ON_START_IMAGES = [
    "orchest/orchest-api:latest",
    "orchest/orchest-webserver:latest",
    "orchest/celery-worker:latest",
    "orchest/auth-server:latest",
    "orchest/file-manager:latest",
    "orchest/nginx-proxy:latest",
    "rabbitmq:3",
]

REQUIRED_ENV_VARS = ["HOST_USER_DIR", "HOST_CONFIG_DIR", "HOST_REPO_DIR"]
ENVS = {}

for var_name in REQUIRED_ENV_VARS:
    ENVS[var_name] = os.environ.get(var_name)
    if ENVS[var_name] is None:
        raise ENVVariableNotFound("%s cannot be found in the environment." % var_name)


CONTAINER_MAPPING = {
    "orchest/orchest-api:latest": {
        "environment": {},
        "command": None,
        "name": "orchest-api",
        "mounts": [
            {
                # TODO: I don't think the orchest-api needs the entire
                #       userdir.
                # Needed for persistent db.
                "source": ENVS["HOST_USER_DIR"],
                "target": "/userdir",
            },
            {"source": "/var/run/docker.sock", "target": "/var/run/docker.sock"},
        ],
    },
    "orchest/orchest-webserver:latest": {
        "name": "orchest-webserver",
        "environment": {
            "HOST_USER_DIR": ENVS["HOST_USER_DIR"],
            "HOST_CONFIG_DIR": ENVS["HOST_CONFIG_DIR"],
            "HOST_REPO_DIR": ENVS["HOST_REPO_DIR"],
        },
        "mounts": [
            {"source": "/var/run/docker.sock", "target": "/var/run/docker.sock"},
            {"source": ENVS["HOST_USER_DIR"], "target": "/userdir"},
            {"source": ENVS["HOST_CONFIG_DIR"], "target": "/config"},
            {"source": ENVS["HOST_REPO_DIR"], "target": "/orchest-host"},
        ],
    },
    "orchest/celery-worker:latest": {
        "name": "celery-worker",
        "mounts": [
            {"source": "/var/run/docker.sock", "target": "/var/run/docker.sock"},
            {
                # Mount is needed for copying the snapshot dir to
                # pipeline run dirs for experiments.
                "source": ENVS["HOST_USER_DIR"],
                "target": "/userdir",
            },
        ],
    },
    "rabbitmq:3": {
        "name": "rabbitmq-server",
        "hostname": "rabbitmq-server",
        "mounts": [
            {
                # Persisting RabbitMQ Queues.
                "source": os.path.join(ENVS["HOST_USER_DIR"], DURABLE_QUEUES_DIR),
                "target": "/var/lib/rabbitmq/mnesia",
            }
        ],
    },
    "orchest/auth-server:latest": {
        "name": "auth-server",
        "environment": {},
        "mounts": [
            {"source": ENVS["HOST_CONFIG_DIR"], "target": "/config"},
            {"source": ENVS["HOST_USER_DIR"], "target": "/userdir"},
        ],
    },
    "orchest/file-manager:latest": {
        "name": "file-manager",
        "mounts": [
            {"source": ENVS["HOST_USER_DIR"], "target": "/userdir"},
        ],
    },
    "orchest/nginx-proxy:latest": {
        "name": "nginx-proxy",
        "ports": {
            "80/tcp": 8000,
            "443/tcp": 443,
        },
        "mounts": [],  # dynamically added in start() based on presence of certs on host
    },
    "orchest/update-server:latest": {
        "name": "update-server",
        "environment": {
            "HOST_USER_DIR": ENVS["HOST_USER_DIR"],
            "HOST_CONFIG_DIR": ENVS["HOST_CONFIG_DIR"],
            "HOST_REPO_DIR": ENVS["HOST_REPO_DIR"],
        },
        "auto_remove": True,
        "mounts": [
            {"source": "/var/run/docker.sock", "target": "/var/run/docker.sock"},
        ],
    },
}
