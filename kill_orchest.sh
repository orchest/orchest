#!/bin/bash

# clean old containers
for ANCESTOR in jupyter-server:latest elyra/enterprise-gateway:2.1.1 elyra/kernel-py:2.1.1 rabbitmq:3 orchest-api celery-worker orchest-webserver
do 
  process_ids=$(docker ps -a -q --filter ancestor=$ANCESTOR --format="{{.ID}}")

  if [ ! -z "$process_ids" ]
  then
    docker kill $process_ids # could replace with `stop` if you need a clean exit
  fi

  if [ ! -z "$process_ids" ]
  then
    docker rm $process_ids
  fi
done