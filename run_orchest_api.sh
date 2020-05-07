#!/bin/bash

## Run orchest api
# clear orchest-api db
rm orchest/orchest-api/app/resources.db 2> /dev/null

# run RabbitMQ
docker run -d --hostname my-rabbit --network orchest --name rabbitmq-server rabbitmq:3

# run celery worker
docker run -d -v /var/run/docker.sock:/var/run/docker.sock --network orchest --name celery-worker celery-worker

# run orchest-api
docker run -v /var/run/docker.sock:/var/run/docker.sock -d --network orchest --name orchest-api orchest-api

# docker run -d -e FLASK_DEBUG=1 -e FLASK_APP=app -v $PWD/orchest/orchest-api/app:/app -v $PWD/orchest/userdir:/userdir -v /var/run/docker.sock:/var/run/docker.sock --name=orchest-api --network=orchest orchest-api flask run --host=0.0.0.0 --port=80