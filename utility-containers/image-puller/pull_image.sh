#!/bin/sh
set -e

if [ "$CONTAINER_RUNTIME" = containerd ]; then
    ctr -n=k8s.io -a=/var/run/runtime.sock i pull "${IMAGE_TO_PULL}" --skip-verify
elif [ "$CONTAINER_RUNTIME" = docker ]; then
    docker -H unix:///var/run/runtime.sock pull "${IMAGE_TO_PULL}" --disable-content-trust
else
    echo "Container runtime is not supported"
    exit 1
fi
