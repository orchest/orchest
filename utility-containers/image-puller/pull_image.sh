#!/bin/bash
set -e

log() {
  timestamp=$(date +"[%m%d %H:%M:%S]")
  echo "${timestamp} ${1-}" >&2
  shift
  for message; do
    echo "${message}" >&2
  done
}


if [ "$CONTAINER_RUNTIME" = containerd ]; then

    # check if image exist
    image_exist=$(ctr -n=k8s.io -a=/var/run/runtime.sock i ls | grep "${IMAGE_TO_PULL}")
    if [[ -n ${image_exist} ]]; then
        log "image exist ${IMAGE_TO_PULL}}, skip pulling"
        exit 0
    fi

    log "attempting to pull exist ${IMAGE_TO_PULL}}"

    ctr -n=k8s.io -a=/var/run/containerd.sock i pull "${IMAGE_TO_PULL}" --skip-verify
elif [ "$CONTAINER_RUNTIME" = docker ]; then

    # check if image exist
    image_exist=$(docker -H unix:///var/run/docker.sock image ls | grep "${IMAGE_TO_PULL}")
    if [[ -n ${image_exist} ]]; then
        log "image exist ${IMAGE_TO_PULL}}, skip pulling"
        exit 0
    fi

    log "attempting to pull exist ${IMAGE_TO_PULL}}"

    ctr -a=/var/run/containerd.sock i pull "${IMAGE_TO_PULL}" --skip-verify && \
    ctr -a=/var/run/containerd.sock i export pulled-image.tar "${IMAGE_TO_PULL}" && \
    docker -H unix:///var/run/docker.sock image import pulled-image.tar "${IMAGE_TO_PULL}"
else
    echo "Container runtime is not supported"
    exit 1
fi
