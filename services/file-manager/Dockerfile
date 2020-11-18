FROM filebrowser/filebrowser:v2.8.0-alpine
LABEL maintainer="Orchest B.V. https://www.orchest.io"

COPY .docker.json /.filebrowser.json

COPY static/ /custom-static

RUN ["/filebrowser", "config", "init", "--branding.name", "File Manager", "--auth.method", "noauth", "--branding.files", "/custom-static"]
RUN ["/filebrowser", "users", "add", "--perm.admin", "admin", "admin"]

