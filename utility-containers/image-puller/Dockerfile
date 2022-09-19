FROM alpine:3.16.0 as base

ARG CONTAINERD_VERSION="1.6.4"
ENV CONTAINERD_DOWNLOAD_URL="https://github.com/containerd/containerd/releases/download/v$CONTAINERD_VERSION/containerd-$CONTAINERD_VERSION-linux-amd64.tar.gz"

RUN apk --update add curl \
    && mkdir -p /tmp/download

# install containerd
RUN curl -L $CONTAINERD_DOWNLOAD_URL --output containerd-$CONTAINERD_VERSION-linux-amd64.tar.gz \
    && tar zxvf containerd-$CONTAINERD_VERSION-linux-amd64.tar.gz -C /tmp/download \
    && mv /tmp/download/bin/ctr /bin

ARG DOCKER_VERSION="20.10.9"
ENV DOCKER_DOWNLOAD_URL="https://download.docker.com/linux/static/stable/x86_64/docker-$DOCKER_VERSION.tgz"
# install docker client
RUN curl -L $DOCKER_DOWNLOAD_URL | tar -xz -C /tmp/download \
    && mv /tmp/download/docker/docker /bin/

 
RUN rm -rf /tmp/download \
    && apk del curl \
    && rm -rf /var/cache/apk/* 

###############################################################################
FROM ubuntu:22.04

LABEL maintainer="Orchest B.V. https://www.orchest.io"

COPY --from=base /bin/ctr /bin/ctr
COPY --from=base /bin/docker /bin/docker

RUN apt-get update && apt-get install -y buildah && buildah version && \
    apt-get clean

COPY ./pull_image.sh /pull_image.sh
RUN chmod +x /pull_image.sh