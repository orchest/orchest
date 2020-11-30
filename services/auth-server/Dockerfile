FROM tiangolo/meinheld-gunicorn-flask:python3.7
LABEL maintainer="Orchest B.V. https://www.orchest.io"

# Refresh SSL certificates
RUN apt-get update && apt-get install -y ca-certificates && update-ca-certificates --fresh

# Install nodejs for jupyterextension install support
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash - && apt-get install -y nodejs

# Get the orchest application, specifically the auth-server
COPY ./ /orchest/services/auth-server
RUN mv /orchest/services/auth-server/lib /orchest/lib
WORKDIR /orchest/services/auth-server/app

RUN pip3 install -r requirements.txt

# Get the internal JS library
RUN mkdir -p app/static/js/src/lib/
RUN cp -R -T /orchest/lib/javascript/ app/static/js/src/lib/

# Compile front-end code with npx and compile style
WORKDIR app/static
RUN npm install
RUN ./compile-js.sh
RUN ./compile-sass.sh

ENV GUNICORN_CONF /orchest/services/auth-server/app/gunicorn_conf.py
# Setting this WORKDIR is required by the base image: "otherwhise uWSGI
# will try to run the app in /app".
WORKDIR /orchest/services/auth-server/app
