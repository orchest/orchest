FROM tiangolo/uwsgi-nginx-flask:python3.7

# Installing the requirements here before copying, allows us to faster
# rebuild containers by using the cache.
RUN pip3 install Flask \
    flask_sqlalchemy \
    Flask-Migrate \
    requests \
    APScheduler \
    pyinotify \
    Werkzeug==0.16.0

COPY ./app /app


# Compile front-end code with npx

# refresh SSL certificates
RUN apt-get update && apt-get install -y ca-certificates && update-ca-certificates --fresh

# install nodejs for jupyterextension install support
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash - && apt-get install -y nodejs

WORKDIR /app/static/

RUN npm install

RUN npx webpack

WORKDIR /app