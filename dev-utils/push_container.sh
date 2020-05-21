#!/bin/bash

docker push orchestsoftware/jupyter-server
docker push orchestsoftware/celery-worker
docker push orchestsoftware/scipy-notebook-augmented
docker push orchestsoftware/r-notebook-augmented

# runnable images
docker push orchestsoftware/scipy-notebook-runnable
docker push orchestsoftware/r-notebook-runnable

# custom enterprise gateway kernel images
docker push orchestsoftware/custom-base-kernel-py
docker push orchestsoftware/custom-base-kernel-r

# application images
docker push orchestsoftware/orchest-api
docker push orchestsoftware/orchest-ctl
docker push orchestsoftware/orchest-webserver
docker push orchestsoftware/nginx-proxy