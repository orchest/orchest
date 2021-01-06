FROM tiangolo/meinheld-gunicorn-flask:python3.8
LABEL maintainer="Orchest B.V. https://www.orchest.io"

# Get all requirements in place.
COPY ./requirements.txt /orchest/services/update-server/
COPY ./lib/python /orchest/lib/python

WORKDIR /orchest/services/update-server
RUN pip3 install -r requirements.txt

# Get the orchest application.
COPY ./app ./app

# Needed by the base image.
WORKDIR /orchest/services/update-server/app
ARG ORCHEST_VERSION
ENV ORCHEST_VERSION=${ORCHEST_VERSION}
ENV GUNICORN_CONF /orchest/services/update-server/app/gunicorn_conf.py
