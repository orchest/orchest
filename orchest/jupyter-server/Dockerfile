FROM tiangolo/uwsgi-nginx-flask:python3.7

RUN pip3 install flask_socketio flask_restplus requests jupyterlab Werkzeug==0.16.1

RUN rm /bin/sh && ln -s /bin/bash /bin/sh

# refresh SSL certificates
RUN apt update && apt install -y ca-certificates && update-ca-certificates --fresh

# install nodejs for jupyterextension install support
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash - && apt-get install -y nodejs

RUN mkdir /root/.jupyter/
COPY jupyter_notebook_config.py /root/.jupyter/jupyter_notebook_config.py

COPY ./app /app

