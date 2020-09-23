#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

HOST_CONFIG_DIR=$HOME/.config/orchest
HOST_USER_DIR=$DIR/userdir

# create config dir if it doesn't exist
mkdir -p "${HOST_CONFIG_DIR}"

docker run --name orchest-ctl --rm \
    -v /var/run/docker.sock:/var/run/docker.sock -e HOST_CONFIG_DIR="${HOST_CONFIG_DIR}" \
    -e HOST_PWD="${DIR}" -e HOST_USER_DIR="${HOST_USER_DIR}" orchestsoftware/orchest-ctl "$@"
