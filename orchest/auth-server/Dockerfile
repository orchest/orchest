FROM tiangolo/uwsgi-nginx-flask:python3.7

# Installing the requirements here before copying, allows us to faster
# rebuild containers by using the cache.
RUN pip3 install Flask==1.1.1 \
    Werkzeug==0.16.0

COPY ./orchest/auth-server/app /app
WORKDIR /app