FROM tiangolo/meinheld-gunicorn-flask:python3.8
LABEL maintainer="Orchest B.V. https://www.orchest.io"

# Get all requirements in place.
COPY ./requirements.txt /orchest/services/orchest-api/
COPY ./lib /orchest/lib

# Set the `WORKDIR` so the editable installs in the `requirements.txt`
# can use relative paths.
WORKDIR /orchest/services/orchest-api/
RUN pip3 install -r requirements.txt

# Setting this `WORKDIR` is required by the base image so that the app
# is run in the correct directory.
COPY ./app ./app
WORKDIR /orchest/services/orchest-api/app

COPY ./start.sh /

ENV GUNICORN_CONF /orchest/services/orchest-api/app/gunicorn_conf.py
ENV APP_MODULE "main:app"
ARG ORCHEST_VERSION
ENV ORCHEST_VERSION=${ORCHEST_VERSION}
