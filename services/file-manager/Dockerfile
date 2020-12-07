FROM filebrowser/filebrowser:v2.8.0-alpine
LABEL maintainer="Orchest B.V. https://www.orchest.io"

# Application files.
COPY ./ /

RUN ["/filebrowser", "config", "init", "--branding.name", "File Manager", "--auth.method", "noauth", "--branding.files", "/static"]
RUN ["/filebrowser", "users", "add", "--perm.admin", "admin", "admin"]

ARG ORCHEST_VERSION
ENV ORCHEST_VERSION=${ORCHEST_VERSION}
