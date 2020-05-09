# give access to docker sock
sudo chmod 0777 /var/run/docker.sock

#kill any containers running
source kill_orchest.sh

# JupyterLab server
docker build -t jupyter-server orchest/jupyter-server

docker build -t celery-worker -f orchest/orchest-api/Dockerfile_celery orchest/orchest-api

docker build -t scipy-notebook-runnable orchest/runnable-docker-image

docker build -t orchest-api orchest/orchest-api/

docker build -t orchest-webserver orchest/webserver/

# RabbitMQ
docker pull rabbitmq:3

# Enterprise Gateway used for docker based kernels in JupyterLab
docker pull elyra/enterprise-gateway:2.1.0

# kernel images for Enterprise Gateway Notebook kernels
docker pull elyra/kernel-py:2.1.1
docker pull elyra/kernel-r:2.1.1
