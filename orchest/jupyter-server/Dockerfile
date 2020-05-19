FROM tiangolo/uwsgi-nginx-flask:python3.7

RUN pip3 install flask_socketio \
    flask_restplus \
    requests \
    jupyterlab \
    Werkzeug==0.16.1

RUN rm /bin/sh && ln -s /bin/bash /bin/sh

# refresh SSL certificates
RUN apt-get update && apt-get install -y ca-certificates && update-ca-certificates --fresh

# install nodejs for jupyterextension install support
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash - && apt-get install -y nodejs

RUN mkdir /root/.jupyter/
COPY jupyter_notebook_config.py /root/.jupyter/jupyter_notebook_config.py

COPY notebook-patch/handlers.py /usr/local/lib/python3.7/site-packages/notebook/gateway/handlers.py

COPY ./app /app

