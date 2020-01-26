#!/bin/bash

## Prepare docker container sock file for in-container docker spawning
sudo chmod 0777 /var/run/docker.sock

# clean old containers
process_ids=$(docker ps -a -q --filter ancestor=jupyter-server:latest --format="{{.ID}}")

if [ ! -z "$process_ids" ]
then
  docker rm $(docker stop $process_ids)
fi

process_ids=$(docker ps -a -q --filter ancestor=elyra/enterprise-gateway:dev --format="{{.ID}}")

if [ ! -z "$process_ids" ]
then
  docker rm $(docker stop $process_ids)
fi

docker container prune -f

## Run orchest api
# clear orchest-api db
rm orchest/orchest-api/api/resources.db

# run orchest-api
python orchest/orchest-api/api/main.py
