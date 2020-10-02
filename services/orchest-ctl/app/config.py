import os

from errors import ENVVariableNotFound


# Can either be "normal" or "dev"
RUN_MODE = "normal"
UPDATE_MODE = "normal"

DOCKER_NETWORK = "orchest"

# Configurations directly related to container specifications.
DURABLE_QUEUES_DIR = ".orchest/rabbitmq-mnesia"

# All the images that are used by Orchest.
ALL_IMAGES = [
    "elyra/enterprise-gateway:2.2.0",
    "orchestsoftware/jupyter-server:latest",
    "orchestsoftware/custom-base-kernel-py:latest",
    "orchestsoftware/custom-base-kernel-r:latest",
    "orchestsoftware/memory-server:latest",
    "orchestsoftware/orchest-ctl:latest",
    "orchestsoftware/update-server:latest",
    "orchestsoftware/orchest-api:latest",
    "orchestsoftware/orchest-webserver:latest",
    "orchestsoftware/celery-worker:latest",
    "orchestsoftware/auth-server:latest",
    "orchestsoftware/nginx-proxy:latest",
    "rabbitmq:3",
]

# Images to be run on start of Orchest.
ON_START_IMAGES = [
    "orchestsoftware/orchest-api:latest",
    "orchestsoftware/orchest-webserver:latest",
    "orchestsoftware/celery-worker:latest",
    "orchestsoftware/auth-server:latest",
    "orchestsoftware/nginx-proxy:latest",
    "rabbitmq:3",
]

REQUIRED_ENV_VARS = ["HOST_USER_DIR", "HOST_CONFIG_DIR", "HOST_REPO_DIR"]
ENVS = {}

for var_name in REQUIRED_ENV_VARS:
    ENVS[var_name] = os.environ.get(var_name)
    if ENVS[var_name] is None:
        raise ENVVariableNotFound("%s cannot be found in the environment." % var_name)


CONTAINER_MAPPING = {
    "orchestsoftware/orchest-api:latest": {
        "environment": {},
        "command": None,
        "name": "orchest-api",
        "mounts": [
            {
                # TODO: I don't think the orchest-api needs the entire
                #       userdir.
                # Needed for persistent db.
                "source": ENVS["HOST_USER_DIR"],
                "target": "/userdir"
            },
            {
                "source": "/var/run/docker.sock",
                "target": "/var/run/docker.sock"
            },
        ],

    },
    "orchestsoftware/orchest-webserver:latest": {
        "name": "orchest-webserver",
        "environment": {
            "HOST_USER_DIR": ENVS["HOST_USER_DIR"],
            "HOST_CONFIG_DIR": ENVS["HOST_CONFIG_DIR"],
            "HOST_REPO_DIR": ENVS["HOST_REPO_DIR"],
        },
        "mounts": [
            {
                "source": "/var/run/docker.sock",
                "target": "/var/run/docker.sock"
            },
            {
                "source": ENVS["HOST_USER_DIR"],
                "target": "/userdir"
            },
            {
                "source": ENVS["HOST_CONFIG_DIR"],
                "target": "/config"
            }
        ],
    },
    "orchestsoftware/celery-worker:latest": {
        "name": "celery-worker",
        "mounts": [
            {
                "source": "/var/run/docker.sock",
                "target": "/var/run/docker.sock"
            },
            {
                # Mount is needed for copying the snapshot dir to
                # pipeline run dirs for experiments.
                "source": ENVS["HOST_USER_DIR"],
                "target": "/userdir"
            },
        ]
    },
    "rabbitmq:3": {
        "name": "rabbitmq-server",
        "hostname": "rabbitmq-hostname",
        "mounts": [
            {
                # Persisting RabbitMQ Queues.
                "source": os.path.join(ENVS["HOST_USER_DIR"], DURABLE_QUEUES_DIR),
                "target": "/var/lib/rabbitmq/mnesia",
            }
        ],
    },
    "orchestsoftware/auth-server:latest": {
        "name": "auth-server",
        "environment": {},
        "mounts": [
            {
                "source": ENVS["HOST_CONFIG_DIR"],
                "target": "/config"
            },
            {
                "source": ENVS["HOST_USER_DIR"],
                "target": "/userdir"
            },
        ],
    },
    "orchestsoftware/nginx-proxy:latest": {
        "name": "nginx-proxy",
        "ports": {
            "80/tcp": 8000,
            "443/tcp": 443,
        }
    },
    "orchestsoftware/update-server:latest": {
        "name": "update-server",
        "hostname": "update-server",
        "environment": {
            "HOST_USER_DIR": ENVS["HOST_USER_DIR"],
            "HOST_CONFIG_DIR": ENVS["HOST_CONFIG_DIR"],
            "HOST_REPO_DIR": ENVS["HOST_REPO_DIR"],
        },
        "auto_remove": True,
        "mounts": [
            {
                "source": "/var/run/docker.sock",
                "target": "/var/run/docker.sock"
            },
        ]
    }
}
