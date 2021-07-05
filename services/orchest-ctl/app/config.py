from typing import List, Set

# NOTE: "orchest/orchest-ctl:latest" is excluded on purpose, since the
# orchest-ctl is not managing itself. Instead the top-level `orchest`
# shell script manages its updates.
_minimal_orchest_images = [
    "orchest/jupyter-enterprise-gateway:latest",
    "orchest/jupyter-server:latest",
    "orchest/memory-server:latest",
    "orchest/session-sidecar:latest",
    "orchest/update-server:latest",
    "orchest/orchest-api:latest",
    "orchest/orchest-webserver:latest",
    "orchest/celery-worker:latest",
    "orchest/auth-server:latest",
    "orchest/file-manager:latest",
    "orchest/nginx-proxy:latest",
    "rabbitmq:3",
    "postgres:13.1",
]

# Images to run when the app is started. The order states the order in
# which the images have to be started due to dependencies between them.
# A collection indicates that its contained images can be started
# asynchronously.
# postgres -> orchest-webserver, orchest-api, auth-server
# rabbitmq -> celery-worker
# ... -> nginx-proxy (otherwise user gets error 500)
_on_start_images: List[Set[str]] = [
    set(
        [
            "postgres:13.1",
            "orchest/file-manager:latest",
            "rabbitmq:3",
        ]
    ),
    set(
        [
            "orchest/orchest-api:latest",
            "orchest/orchest-webserver:latest",
            "orchest/celery-worker:latest",
            "orchest/auth-server:latest",
        ]
    ),
    set(
        [
            "orchest/nginx-proxy:latest",
        ]
    ),
]

ORCHEST_IMAGES = {
    "minimal": _minimal_orchest_images,
    "all": _minimal_orchest_images
    + [
        "orchest/base-kernel-py:latest",
        "orchest/base-kernel-py-gpu:latest",
        "orchest/base-kernel-r:latest",
        "orchest/base-kernel-julia:latest",
    ],
}

WRAP_LINES = 72

ORCHEST_WEBSERVER_ADDRESS = "http://orchest-webserver:80"

# CLI
INTERNAL_ERR_MESSAGE = "It seems like Orchest experienced an internal server error."
ALLOWED_BUILD_FAILURES = 5
