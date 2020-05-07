FROM tiangolo/uwsgi-nginx-flask:python3.7

# Installing the requirements here before copying, allows us to faster
# rebuild containers by using the cache.
RUN pip3 install aiodocker==0.18.3 \
    aiohttp==3.6.2 \
    amqp==2.5.2 \
    celery==4.4.2 \
    docker==4.1.0 \
    Flask==1.1.1 \
    Flask-Cors==3.0.8 \
    flask-restplus==0.13.0 \
    Flask-SQLAlchemy==2.4.1 \
    pytest==5.4.1 \
    requests==2.22.0 \
    Werkzeug==0.16.0

COPY ./app /app

WORKDIR /app

# In case we forgot to update the first RUN command accordingly to the
# new requirements. Note that pip will not reinstall already installed
# packages.
RUN pip3 install -r requirements.txt
