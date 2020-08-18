FROM tiangolo/uwsgi-nginx-flask:python3.7

# Installing the requirements here before copying, allows us to faster
# rebuild containers by using the cache.
RUN pip3 install Flask==1.1.1 \
    Werkzeug==0.16.0

COPY ./orchest/auth-server/app /app
WORKDIR /app


# In case we forgot to update the first RUN command accordingly to the
# new requirements. Note that pip will not reinstall already installed
# packages.
RUN pip3 install -r requirements.txt