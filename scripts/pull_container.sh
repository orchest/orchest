#!/bin/bash

set -e

IMGS=()
BUILD_TAG="latest"

while getopts "i:t:" opt; do
  case $opt in
    i)
      IMGS+=($OPTARG)
      ;;
    t)
      BUILD_TAG="$OPTARG"
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      ;;
  esac
done

# Login to be able to pull from DockerHub
echo "$DOCKER_PASSWORD" | docker login --username "$DOCKER_USERNAME" --password-stdin

for IMG in ${IMGS[@]}
do
    docker pull "orchest/$IMG:$BUILD_TAG" &
done

# Pull the images in parallel.
wait < <(jobs -p)
