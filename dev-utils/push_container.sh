#!/bin/bash

docker push orchestsoftware/jupyter-server
docker push orchestsoftware/celery-worker

# custom enterprise gateway kernel images
docker push orchestsoftware/custom-base-kernel-py
docker push orchestsoftware/custom-base-kernel-r

# application images
docker push orchestsoftware/orchest-api
docker push orchestsoftware/orchest-ctl
docker push orchestsoftware/orchest-webserver
docker push orchestsoftware/nginx-proxy