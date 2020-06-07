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

# Windows needs this to run the script correctly
# https://stackoverflow.com/questions/37419042/container-command-start-sh-not-found-or-does-not-exist-entrypoint-to-contain    
#RUN sed -i 's/\r$//' ./compile-sass.sh  && \
#chmod +x ./compile-sass.sh


RUN ./compile-sass.sh

WORKDIR /app

# https://github.com/tiangolo/full-stack-fastapi-postgresql/issues/41
#RUN sed -i 's/\r$//' ./prestart.sh  && \
#chmod +x ./prestart.sh