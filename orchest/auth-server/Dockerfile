FROM tiangolo/uwsgi-nginx-flask:python3.7

# Installing the requirements here before copying, allows us to faster
# rebuild containers by using the cache.
RUN pip3 install Flask==1.1.1 \
    Werkzeug==0.16.0 \ 
    Flask-SQLAlchemy==2.4.1

# Install our internal libraries
COPY ./lib/python /src
RUN pip3 install -e /src/orchest-internals/

# Application
COPY ./orchest/auth-server/app /app

# Internal JS library
COPY ./lib/javascript /app/app/static/js/src/lib

WORKDIR /app

# In case we forgot to update the first RUN command accordingly to the
# new requirements. Note that pip will not reinstall already installed
# packages.
RUN pip3 install -r requirements.txt
