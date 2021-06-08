FROM python:3.8-slim
LABEL maintainer="Orchest B.V. https://www.orchest.io"

# Needed for making sure if/when the sidecar is listening.
RUN apt-get update && apt-get install -y net-tools

# Get all requirements in place.
COPY ./requirements.txt /orchest/services/session-sidecar/
COPY ./lib/python /orchest/lib/python

# Set the `WORKDIR` so the editable installs in the `requirements.txt`
# can use relative paths.
WORKDIR /orchest/services/session-sidecar
RUN pip3 install -r requirements.txt

# Application files.
COPY ./app ./app

ARG ORCHEST_VERSION
ENV ORCHEST_VERSION=${ORCHEST_VERSION}
# The umask is needed because the sidecar will attempt to create the
# logs directory if it does not exist already, leading to permission
# issues if umask is not used.
ENTRYPOINT ["/bin/sh", "-c", "umask 002 && python -u app/main.py"]
