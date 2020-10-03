FROM tiangolo/meinheld-gunicorn-flask:python3.7

# Get the orchest application, specifically the auth-server
RUN mkdir -p /orchest/services/update-server/
COPY ./ /orchest/services/update-server

WORKDIR /orchest/services/update-server/app

RUN pip3 install -r requirements.txt

ENV GUNICORN_CONF /orchest/services/update-server/app/gunicorn_conf.py