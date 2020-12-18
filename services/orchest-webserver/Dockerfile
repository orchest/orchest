FROM tiangolo/meinheld-gunicorn-flask:python3.7
LABEL maintainer="Orchest B.V. https://www.orchest.io"

# Refresh SSL certificates
RUN apt-get update && apt-get install -y sudo ca-certificates && update-ca-certificates --fresh

# Install nodejs for jupyterextension install support
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash - && apt-get install -y nodejs

# Install the Python requirements before the JS compiling, because
# changes in the front-end often include JS changes meaning that its
# cache is more likely to be invalidated.
COPY ./requirements.txt /orchest/services/orchest-webserver/
COPY ./lib/python /orchest/lib/python

# Set the `WORKDIR` so the editable installs in the `requirements.txt`
# can use relative paths.
WORKDIR /orchest/services/orchest-webserver
RUN pip3 install --upgrade pip && pip3 install -r requirements.txt

# Static application files.
COPY ./app/static ./app/static
COPY ./lib/javascript/ ./app/static/js/lib/

# Compile front-end code with npx and compile style.
WORKDIR /orchest/services/orchest-webserver/app/static
RUN npm install && \
    ./compile-js.sh && ./compile-sass.sh && \
    rm -rf node_modules/
    
# Application files.
WORKDIR /orchest/services/orchest-webserver/
COPY ./app ./app

# Setting this WORKDIR is required by the base image: "otherwhise gunicorn
# will try to run the app in /app". Additionally, we need to specify a
# custom path for the `gunicorn_conf.py` file.
WORKDIR /orchest/services/orchest-webserver/app

ENV GUNICORN_CONF /orchest/services/orchest-webserver/app/gunicorn_conf.py
ENV APP_MODULE "main:app"
ARG ORCHEST_VERSION
ENV ORCHEST_VERSION=${ORCHEST_VERSION}
COPY ./start.sh /
