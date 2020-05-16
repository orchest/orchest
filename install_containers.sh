#kill any containers running
source kill_orchest.sh

# JupyterLab server
docker build -t jupyter-server orchest/jupyter-server

docker build -t celery-worker -f orchest/orchest-api/Dockerfile_celery orchest/orchest-api

# augmented images
docker build -t scipy-notebook-augmented \
    orchest/custom-images/scipy-notebook-augmented

docker build -t r-notebook-augmented \
    orchest/custom-images/r-notebook-augmented

# runnable images
docker build -t scipy-notebook-runnable \
    -f orchest/custom-images/runnable-images/scipy-notebook-runnable/Dockerfile orchest/custom-images/runnable-images

docker build -t r-notebook-runnable \
    -f orchest/custom-images/runnable-images/r-notebook-runnable/Dockerfile orchest/custom-images/runnable-images

# custom enterprise gateway kernel images
docker build -t custom-base-kernel-py \
    -f orchest/custom-images/custom-base-kernel-py/Dockerfile orchest/custom-images/scipy-notebook-augmented

docker build -t custom-base-kernel-r \
    -f orchest/custom-images/custom-base-kernel-r/Dockerfile orchest/custom-images/r-notebook-augmented

# application images
docker build -t orchest-api orchest/orchest-api/

docker build -t orchest-ctl orchest/orchest-ctl/

docker build -t orchest-webserver orchest/orchest-webserver/


# RabbitMQ
docker pull rabbitmq:3

# Enterprise Gateway used for docker based kernels in JupyterLab
docker pull elyra/enterprise-gateway:2.1.1