FROM tiangolo/meinheld-gunicorn-flask:python3.8
LABEL maintainer="Orchest B.V. https://www.orchest.io"

# Refresh SSL certificates
RUN apt-get update && apt-get install -y ca-certificates && update-ca-certificates --fresh

# Install nodejs for jupyterextension install support
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash - && apt-get install -y nodejs

# Get all Python requirements in place and install them.
COPY ./requirements.txt /orchest/services/auth-server/
COPY ./lib/python /orchest/lib/python
WORKDIR /orchest/services/auth-server
RUN pip3 install -r requirements.txt

# Get the internal JS library
COPY ./app/static ./app/static
COPY ./lib/javascript/ app/static/js/src/lib/

# Compile front-end code with npx and compile style
WORKDIR /orchest/services/auth-server/app/static
RUN npm install
RUN ./compile-js.sh && ./compile-sass.sh \
  && rm -rf node_modules/

# Application files.
WORKDIR /orchest/services/auth-server
COPY ./app ./app

# Required by base image.
ENV GUNICORN_CONF /orchest/services/auth-server/app/gunicorn_conf.py
ARG ORCHEST_VERSION
ENV ORCHEST_VERSION=${ORCHEST_VERSION}
WORKDIR /orchest/services/auth-server/app
