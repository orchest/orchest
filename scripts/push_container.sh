#!/bin/bash

set -e

IMGS=()

while getopts "s:i:nve" opt; do
  case $opt in
    i)
      IMGS+=($OPTARG)
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      ;;
  esac
done

# Login to be able to push to DockerHub
docker login --username "$DOCKER_USERNAME" --password "$DOCKER_PASSWORD"

for IMG in ${IMGS[@]}
do
    docker push "orchestsoftware/$IMG"
done

# TODO: remove .docker/config.json as it will store the password or does
# GitHub Actions take care of this for us?

# docker push orchestsoftware/jupyter-server

# docker push orchestsoftware/celery-worker
# docker push orchestsoftware/memory-server

# # custom enterprise gateway kernel images
# docker push orchestsoftware/orchest-ctl
# docker push orchestsoftware/custom-base-kernel-py
# docker push orchestsoftware/custom-base-kernel-r

# # application images
# docker push orchestsoftware/orchest-api
# docker push orchestsoftware/auth-server
# docker push orchestsoftware/orchest-webserver

# docker push orchestsoftware/nginx-proxy
