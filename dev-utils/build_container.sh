#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# # JupyterLab server
if [[ ($1 == "jupyter-server") || ! $1 ]]; then
    docker build -t orchestsoftware/jupyter-server $DIR/../orchest/jupyter-server
fi

if [[ ($1 == "celery-worker") || ! $1 ]]; then
    docker build -t orchestsoftware/celery-worker -f $DIR/../orchest/orchest-api/Dockerfile_celery $DIR/../orchest/orchest-api
fi

# augmented images
if [[ ($1 == "scipy-notebook-augmented") || ! $1 ]]; then
    docker build -t orchestsoftware/scipy-notebook-augmented \
        $DIR/../orchest/custom-images/scipy-notebook-augmented
fi

if [[ ($1 == "r-notebook-augmented") || ! $1 ]]; then
    docker build -t orchestsoftware/r-notebook-augmented \
        $DIR/../orchest/custom-images/r-notebook-augmented
fi

# runnable images
if [[ ($1 == "scipy-notebook-runnable") || ! $1 ]]; then
    docker build -t orchestsoftware/scipy-notebook-runnable \
        -f $DIR/../orchest/custom-images/runnable-images/scipy-notebook-runnable/Dockerfile $DIR/../orchest/custom-images/runnable-images
fi

if [[ ($1 == "r-notebook-runnable") || ! $1 ]]; then
    docker build -t orchestsoftware/r-notebook-runnable \
        -f $DIR/../orchest/custom-images/runnable-images/r-notebook-runnable/Dockerfile $DIR/../orchest/custom-images/runnable-images
fi

# custom enterprise gateway kernel images
if [[ ($1 == "custom-base-kernel-py") || ! $1 ]]; then
    docker build -t orchestsoftware/custom-base-kernel-py \
        -f $DIR/../orchest/custom-images/custom-base-kernel-py/Dockerfile $DIR/../orchest/custom-images/scipy-notebook-augmented
fi

if [[ ($1 == "custom-base-kernel-r") || ! $1 ]]; then
    docker build -t orchestsoftware/custom-base-kernel-r \
        -f $DIR/../orchest/custom-images/custom-base-kernel-r/Dockerfile $DIR/../orchest/custom-images/r-notebook-augmented
fi

# application images

if [[ ($1 == "orchest-api") || ! $1 ]]; then
    docker build -t orchestsoftware/orchest-api $DIR/../orchest/orchest-api/
fi

if [[ ($1 == "orchest-ctl") || ! $1 ]]; then
    docker build -t orchestsoftware/orchest-ctl $DIR/../orchest/orchest-ctl/
fi

if [[ ($1 == "orchest-webserver") || ! $1 ]]; then
    docker build -t orchestsoftware/orchest-webserver $DIR/../orchest/orchest-webserver/
fi

if [[ ($1 == "nginx-proxy") || ! $1 ]]; then
    docker build -t orchestsoftware/nginx-proxy $DIR/../orchest/nginx-proxy/
fi