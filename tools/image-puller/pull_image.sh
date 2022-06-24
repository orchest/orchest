#!/bin/sh
set -e

if [ "$TESTVAR" == "containerd" ]
    ctr -n=k8s.io -a=/var/run/runtime.sock i pull "${IMAGE_TO_PULL}" --skip-verify
elif [ "$TESTVAR" == "docker" ]
    docker -H unix:///var/run/runtime.sock pull "${IMAGE_TO_PULL}"
else
    echo "Container runtime is not supported"
    exit 1
fi

