FROM tiangolo/uwsgi-nginx-flask:python3.7

# Installing the requirements here before copying, allows us to faster
# rebuild containers by using the cache.
RUN pip3 install Flask \
    flask_sqlalchemy \
    Flask-Migrate \
    requests \
    APScheduler \
    pyinotify \
    nbformat \
    nbconvert \
    Werkzeug==0.16.0

# refresh SSL certificates
RUN apt-get update && apt-get install -y ca-certificates && update-ca-certificates --fresh

# install nodejs for jupyterextension install support
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash - && apt-get install -y nodejs

COPY ./app /app

WORKDIR /app/static/

RUN npm install

# Compile front-end code with npx
RUN npx webpack

# Compile style
WORKDIR /app/static/css/

# Compile style, compile-sass.sh and prestart.sh need LF line endings
RUN ./compile-sass.sh
WORKDIR /app