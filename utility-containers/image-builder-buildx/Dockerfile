FROM docker
LABEL maintainer="Orchest B.V. https://www.orchest.io"
COPY --from=docker/buildx-bin /buildx /usr/libexec/docker/cli-plugins/docker-buildx
RUN docker buildx version