@echo off

SET DIR=%~dp0
set container="%1"

if %container% == "" (
    echo building all containers...
)


rem JupyterLab server
if %container% == "" (
    docker build -t orchestsoftware/jupyter-server %DIR%..\orchest\jupyter-server
) else (
    if %container% == "jupyter-server" (
        docker build -t orchestsoftware/jupyter-server %DIR%..\orchest\jupyter-server
    )
)

if %container% == "" (
    docker build -t orchestsoftware/celery-worker -f %DIR%..\orchest\orchest-api\Dockerfile_celery %DIR%..\orchest\orchest-api
) else (
    if %container% == "celery-worker" (
        docker build -t orchestsoftware/celery-worker -f %DIR%..\orchest\orchest-api\Dockerfile_celery %DIR%..\orchest\orchest-api
    )
)


rem augmented images
if %container% == "" (
    docker build -t orchestsoftware/scipy-notebook-augmented ^
            %DIR%..\orchest\custom-images\scipy-notebook-augmented
) else (
    if %container% == "scipy-notebook-augmented" (
        docker build -t orchestsoftware/scipy-notebook-augmented \
            %DIR%..\orchest\custom-images\scipy-notebook-augmented
    )
)

if %container% == "" (
    docker build -t orchestsoftware/r-notebook-augmented ^
            %DIR%..\orchest\custom-images\r-notebook-augmented
) else (
    if %container% == "r-notebook-augmented" (
        docker build -t orchestsoftware/r-notebook-augmented ^
            %DIR%..\orchest\custom-images\r-notebook-augmented
    )
)


rem runnable images
if %container% == "" (
    docker build -t orchestsoftware/scipy-notebook-runnable ^
            -f %DIR%..\orchest\custom-images\runnable-images\scipy-notebook-runnable\Dockerfile %DIR%..\orchest\custom-images\runnable-images
) else (
    if %container% == "scipy-notebook-runnable" (
        docker build -t orchestsoftware/scipy-notebook-runnable ^
            -f %DIR%..\orchest\custom-images\runnable-images\scipy-notebook-runnable\Dockerfile %DIR%..\orchest\custom-images\runnable-images
    )
)

if %container% == "" (
    docker build -t orchestsoftware/r-notebook-runnable ^
            -f %DIR%..\orchest\custom-images\runnable-images\r-notebook-runnable\Dockerfile %DIR%..\orchest\custom-images\runnable-images
) else (
    if %container% == "r-notebook-runnable" (
        docker build -t orchestsoftware/r-notebook-runnable ^
            -f %DIR%..\orchest\custom-images\runnable-images\r-notebook-runnable\Dockerfile %DIR%..\orchest\custom-images\runnable-images
    )
)


rem custom enterprise gateway kernel images
if %container% == "" (
    docker build -t orchestsoftware/custom-base-kernel-py ^
            -f %DIR%..\orchest\custom-images\custom-base-kernel-py\Dockerfile %DIR%..\orchest\custom-images\scipy-notebook-augmented
) else (
    if %container% == "custom-base-kernel-py" (
        docker build -t orchestsoftware/custom-base-kernel-py ^
            -f %DIR%..\orchest\custom-images\custom-base-kernel-py\Dockerfile %DIR%..\orchest\custom-images\scipy-notebook-augmented
    )
)

if %container% == "" (
    docker build -t orchestsoftware/custom-base-kernel-r ^
            -f %DIR%..\orchest\custom-images\custom-base-kernel-r\Dockerfile %DIR%..\orchest\custom-images\r-notebook-augmented
) else (
    if %container% == "custom-base-kernel-r" (
        docker build -t orchestsoftware/custom-base-kernel-r ^
            -f %DIR%..\orchest\custom-images\custom-base-kernel-r\Dockerfile %DIR%..\orchest\custom-images\r-notebook-augmented
    )
)


rem application images
if %container% == "" (
    docker build -t orchestsoftware/orchest-api %DIR%..\orchest\orchest-api\
) else (
    if %container% == "orchest-api" (
        docker build -t orchestsoftware/orchest-api %DIR%..\orchest\orchest-api\
    )
)

if %container% == "" (
    docker build -t orchestsoftware/orchest-ctl %DIR%..\orchest\orchest-ctl\
) else (
    if %container% == "orchest-ctl" (
        docker build -t orchestsoftware/orchest-ctl %DIR%..\orchest\orchest-ctl\
    )
)

if %container% == "" (
    docker build -t orchestsoftware/orchest-webserver %DIR%..\orchest\orchest-webserver\
) else (
    if %container% == "orchest-webserver" (
        docker build -t orchestsoftware/orchest-webserver %DIR%..\orchest\orchest-webserver\
    )
)

if %container% == "" (
    docker build -t orchestsoftware/nginx-proxy %DIR%..\orchest\nginx-proxy\
) else (
    if %container% == "nginx-proxy" (
        docker build -t orchestsoftware/nginx-proxy %DIR%..\orchest\nginx-proxy\
    )
)