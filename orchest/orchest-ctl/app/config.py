import os

from errors import ENVVariableNotFound


# Can either be "normal" or "dev"
RUN_MODE = "normal"

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

HOST_USER_DIR = os.environ.get("HOST_USER_DIR")
if HOST_USER_DIR is None:
    raise ENVVariableNotFound("HOST_USER_DIR cannot be found in the environment.")

HOST_CONFIG_DIR = os.environ.get("HOST_CONFIG_DIR")
if HOST_CONFIG_DIR is None:
    raise ENVVariableNotFound("HOST_CONFIG_DIR cannot be found in the environment.")

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
                "source": HOST_USER_DIR,
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
            "HOST_USER_DIR": HOST_USER_DIR,
        },
        "mounts": [
            {
                "source": "/var/run/docker.sock",
                "target": "/var/run/docker.sock"
            },
            {
                "source": HOST_USER_DIR,
                "target": "/userdir"
            },
            {
                "source": HOST_CONFIG_DIR,
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
                "source": HOST_USER_DIR,
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
                "source": os.path.join(HOST_USER_DIR, DURABLE_QUEUES_DIR),
                "target": "/var/lib/rabbitmq/mnesia",
            }
        ],
    },
    "orchestsoftware/auth-server:latest": {
        "name": "auth-server",
        "environment": {},
        "mounts": [
            {
                "source": HOST_CONFIG_DIR,
                "target": "/config"
            },
            {
                "source": HOST_USER_DIR,
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
}
