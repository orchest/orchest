FROM tiangolo/uwsgi-nginx-flask:python3.7

# Installing the requirements here before copying, allows us to faster
# rebuild containers by using the cache.
RUN pip3 install Flask \
    flask_sqlalchemy \
    Flask-Migrate \
    requests \
    APScheduler \
    Werkzeug==0.16.0

COPY ./app /app

WORKDIR /app