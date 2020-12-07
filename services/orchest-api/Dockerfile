FROM tiangolo/meinheld-gunicorn-flask:python3.7
LABEL maintainer="Orchest B.V. https://www.orchest.io"

# Get all requirements in place.
COPY ./requirements.txt ./start.sh /orchest/services/orchest-api/
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
ARG ORCHEST_VERSION
ENV ORCHEST_VERSION=${ORCHEST_VERSION}
