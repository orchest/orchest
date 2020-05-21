FROM tiangolo/uwsgi-nginx-flask:python3.7

RUN pip3 install flask_socketio \
    flask_restplus \
    requests \
    notebook==6.0.3 \
    jupyterlab \
    Werkzeug==0.16.1

RUN rm /bin/sh && ln -s /bin/bash /bin/sh

# refresh SSL certificates
RUN apt-get update && apt-get install -y ca-certificates && update-ca-certificates --fresh

# install nodejs for jupyterextension install support
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash - && apt-get install -y nodejs

RUN mkdir /root/.jupyter/
COPY jupyter_notebook_config.py /root/.jupyter/jupyter_notebook_config.py

# install extension
COPY extensions/visual-tags /extensions/visuals-tags

WORKDIR /extensions/visual-tags

# set directory permissions since npm install won't run as root (for security purposes)
RUN chmod 0766 .
RUN npm install
RUN jupyter labextension install

# patch handlers.py to allow for CORS on websocket to kernels for gateway Jupyter mode
COPY notebook-patch/handlers.py /usr/local/lib/python3.7/site-packages/notebook/gateway/handlers.py

COPY ./app /app

