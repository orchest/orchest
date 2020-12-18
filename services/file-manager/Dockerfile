FROM filebrowser/filebrowser:v2.8.0-alpine
LABEL maintainer="Orchest B.V. https://www.orchest.io"

# Application files.
COPY ./ /

RUN /filebrowser config init --branding.name "File Manager" --auth.method noauth --branding.files /static && \
    /filebrowser users add --perm.admin admin admin && \
    chmod o+rw /database.db

ARG ORCHEST_VERSION
ENV ORCHEST_VERSION=${ORCHEST_VERSION}

ENTRYPOINT ["/bin/sh", "-c", "umask 002 && /filebrowser"]