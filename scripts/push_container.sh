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
echo "$DOCKER_PASSWORD" | docker login --username "$DOCKER_USERNAME" --password--stdin

for IMG in ${IMGS[@]}
do
    docker push "orchestsoftware/$IMG"
done

# TODO: remove .docker/config.json as it will store the password or does
# GitHub Actions take care of this for us?
