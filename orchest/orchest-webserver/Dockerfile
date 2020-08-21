FROM tiangolo/uwsgi-nginx-flask:python3.7

# Refresh SSL certificates
RUN apt-get update && apt-get install -y ca-certificates && update-ca-certificates --fresh

# Install nodejs for jupyterextension install support
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash - && apt-get install -y nodejs

# Get the orchest application, specifically the orchest-webserver
COPY ./ /orchest/
WORKDIR /orchest/orchest/orchest-webserver/app

RUN pip3 install -r requirements.txt

# Get the internal JS library
RUN mkdir -p static/js/lib/
COPY ./lib/javascript/. static/js/lib/

# Compile front-end code with npx and compile style
WORKDIR static
RUN npm install
RUN ./compile-js.sh
RUN ./compile-sass.sh

# Setting this WORKDIR is required by the base image: "otherwhise uWSGI
# will try to run the app in /app". Additionally, we need to specify a
# custom path for the `uwsgi.ini` file.
WORKDIR /orchest/orchest/orchest-webserver/app
ENV UWSGI_INI uwsgi.ini
