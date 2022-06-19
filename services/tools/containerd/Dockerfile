FROM alpine:3.16.0 as base

ARG CONTAINERD_VERSION="1.6.4"
ENV DOWNLOAD_URL="https://github.com/containerd/containerd/releases/download/v$CONTAINERD_VERSION/containerd-$CONTAINERD_VERSION-linux-amd64.tar.gz"

# install containerd
RUN apk --update add curl \
    && mkdir -p /tmp/download \
    && curl -L $DOWNLOAD_URL | tar -xz -C /tmp/download \
    && mv /tmp/download/bin/ctr /usr/local/bin/ \
    && rm -rf /tmp/download \
    && apk del curl \
    && rm -rf /var/cache/apk/*

###############################################################################
FROM busybox:1.35.0

COPY --from=base /usr/local/bin/ctr /usr/local/bin/ctr
COPY ./pull_image.sh /pull_image.sh
RUN chmod +x /pull_image.sh