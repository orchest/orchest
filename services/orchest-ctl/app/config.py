_minimal_orchest_images = [
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
    "postgres:13.1",
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

DOCKER_NETWORK = "orchest"

WRAP_LINES = 72
