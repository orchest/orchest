FROM tiangolo/meinheld-gunicorn-flask:python3.7

# Refresh SSL certificates
RUN apt-get update && apt-get install -y ca-certificates && update-ca-certificates --fresh

# Install nodejs for jupyterextension install support
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash - && apt-get install -y nodejs

RUN mkdir -p /orchest/orchest/orchest-webserver
COPY ./app /orchest/orchest/orchest-webserver/app
COPY ./lib /orchest/lib
WORKDIR /orchest/orchest/orchest-webserver/app
RUN pip3 install -r requirements.txt

COPY ./lib/javascript/. /orchest/orchest/orchest-webserver/app/static/js/lib/

# Compile front-end code with npx and compile style
WORKDIR /orchest/orchest/orchest-webserver/app/static
RUN npm install
RUN ./compile-js.sh
RUN ./compile-sass.sh

# Setting this WORKDIR is required by the base image: "otherwhise gunicorn
# will try to run the app in /app". Additionally, we need to specify a
# custom path for the `gunicorn_conf.py` file.
WORKDIR /orchest/orchest/orchest-webserver/app
ENV GUNICORN_CONF /orchest/orchest/orchest-webserver/app/gunicorn_conf.py
