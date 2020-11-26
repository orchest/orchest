FROM tiangolo/meinheld-gunicorn-flask:python3.7
LABEL maintainer="Orchest B.V. https://www.orchest.io"

COPY ./lib /orchest/lib
COPY ./app /orchest/services/orchest-api/app

# Setting this WORKDIR is required by the base image: "otherwhise uWSGI
# will try to run the app in /app".
WORKDIR /orchest/services/orchest-api/app
RUN pip3 install -r requirements.txt

ENV GUNICORN_CONF /orchest/services/orchest-api/app/gunicorn_conf.py
COPY ./start.sh /start.sh