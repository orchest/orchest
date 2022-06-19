FROM alpine:3.16.0 as base

ARG DOCKER_VERSION="20.10.9"
ENV DOWNLOAD_URL="https://download.docker.com/linux/static/stable/x86_64/docker-$DOCKER_VERSION.tgz"

# install docker client
RUN apk --update add curl \
    && mkdir -p /tmp/download \
    && curl -L $DOWNLOAD_URL | tar -xz -C /tmp/download \
    && mv /tmp/download/docker/docker /usr/local/bin/ \
    && rm -rf /tmp/download \
    && apk del curl \
    && rm -rf /var/cache/apk/*

###############################################################################
FROM busybox:1.35.0

COPY --from=base /usr/local/bin/docker /usr/local/bin/docker
COPY ./pull_image.sh /pull_image.sh
RUN chmod +x /pull_image.sh