#!/bin/bash

HOST_CONFIG_DIR=$HOME/.config/orchest
HOST_USER_DIR=$PWD/orchest/userdir/

# create config dir if it doesn't exist
mkdir -p $HOST_CONFIG_DIR

docker run --name orchest-ctl -v /var/run/docker.sock:/var/run/docker.sock -e HOST_CONFIG_DIR=$HOST_CONFIG_DIR -e HOST_PWD=$PWD -e HOST_USER_DIR=$HOST_USER_DIR orchestsoftware/orchest-ctl "$@"
docker rm orchest-ctl