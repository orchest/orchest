#!/bin/bash

## Prepare docker container sock file for in-container docker spawning
sudo chmod 0777 /var/run/docker.sock

# clean old containers
process_ids=$(docker ps -a -q --filter ancestor=jupyter-server:latest --format="{{.ID}}")

if [ ! -z "$process_ids" ]
then
  docker kill $(docker stop $process_ids)
fi

if [ ! -z "$process_ids" ]
then
  docker rm $(docker stop $process_ids)
fi

process_ids=$(docker ps -a -q --filter ancestor=elyra/enterprise-gateway:2.1.0 --format="{{.ID}}")

if [ ! -z "$process_ids" ]
then
  docker kill $(docker stop $process_ids)
fi

if [ ! -z "$process_ids" ]
then
  docker rm $(docker stop $process_ids)
fi


docker container prune -f

## Run orchest api
# clear orchest-api db
rm orchest/orchest-api/app/resources.db


# run celery worker



# run orchest-api
python orchest/orchest-api/main.py
