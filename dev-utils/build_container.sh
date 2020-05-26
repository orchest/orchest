#!/bin/bash

# # JupyterLab server
if [[ ($1 == "jupyter-server") || ! $1 ]]; then
    docker build -t orchestsoftware/jupyter-server ../orchest/jupyter-server
fi

if [[ ($1 == "celery-worker") || ! $1 ]]; then
    docker build -t orchestsoftware/celery-worker -f ../orchest/orchest-api/Dockerfile_celery ../orchest/orchest-api
fi

# augmented images
if [[ ($1 == "scipy-notebook-augmented") || ! $1 ]]; then
    docker build -t orchestsoftware/scipy-notebook-augmented \
        ../orchest/custom-images/scipy-notebook-augmented
fi

if [[ ($1 == "r-notebook-augmented") || ! $1 ]]; then
    docker build -t orchestsoftware/r-notebook-augmented \
        ../orchest/custom-images/r-notebook-augmented
fi

# runnable images
if [[ ($1 == "scipy-notebook-runnable") || ! $1 ]]; then
    docker build -t orchestsoftware/scipy-notebook-runnable \
        -f ../orchest/custom-images/runnable-images/scipy-notebook-runnable/Dockerfile ../orchest/custom-images/runnable-images
fi

if [[ ($1 == "r-notebook-runnable") || ! $1 ]]; then
    docker build -t orchestsoftware/r-notebook-runnable \
        -f ../orchest/custom-images/runnable-images/r-notebook-runnable/Dockerfile ../orchest/custom-images/runnable-images
fi

# custom enterprise gateway kernel images
if [[ ($1 == "custom-base-kernel-py") || ! $1 ]]; then
    docker build -t orchestsoftware/custom-base-kernel-py \
        -f ../orchest/custom-images/custom-base-kernel-py/Dockerfile ../orchest/custom-images/scipy-notebook-augmented
fi

if [[ ($1 == "custom-base-kernel-r") || ! $1 ]]; then
    docker build -t orchestsoftware/custom-base-kernel-r \
        -f ../orchest/custom-images/custom-base-kernel-r/Dockerfile ../orchest/custom-images/r-notebook-augmented
fi

# application images

if [[ ($1 == "orchest-api") || ! $1 ]]; then
    docker build -t orchestsoftware/orchest-api ../orchest/orchest-api/
fi

if [[ ($1 == "orchest-ctl") || ! $1 ]]; then
    docker build -t orchestsoftware/orchest-ctl ../orchest/orchest-ctl/
fi

if [[ ($1 == "orchest-webserver") || ! $1 ]]; then
    docker build -t orchestsoftware/orchest-webserver ../orchest/orchest-webserver/
fi

if [[ ($1 == "nginx-proxy") || ! $1 ]]; then
    docker build -t orchestsoftware/nginx-proxy ../orchest/nginx-proxy/
fi