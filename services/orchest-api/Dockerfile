FROM tiangolo/meinheld-gunicorn-flask:python3.7
LABEL maintainer="Orchest B.V. https://www.orchest.io"

# Make sudo available for more granular user permissions
RUN apt-get update && apt-get install -y sudo

# Get all requirements in place.
COPY ./requirements.txt /orchest/services/orchest-api/
COPY ./start.sh ./user_permission_setup.sh /
COPY ./lib /orchest/lib

# Set the `WORKDIR` so the editable installs in the `requirements.txt`
# can use relative paths.
WORKDIR /orchest/services/orchest-api/
RUN pip3 install -r requirements.txt

# Setting this `WORKDIR` is required by the base image so that the app
# is run in the correct directory.
COPY ./app ./app
WORKDIR /orchest/services/orchest-api/app

ENV GUNICORN_CONF /orchest/services/orchest-api/app/gunicorn_conf.py
ENV APP_MODULE "main:app"
ARG ORCHEST_VERSION
ENV ORCHEST_VERSION=${ORCHEST_VERSION}
