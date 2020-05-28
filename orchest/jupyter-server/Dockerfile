FROM tiangolo/uwsgi-nginx-flask:python3.7

# refresh SSL certificates
RUN apt-get update && apt-get install -y ca-certificates && update-ca-certificates --fresh

# install nodejs for jupyterextension install support
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash - && apt-get install -y nodejs

RUN pip3 install git+https://github.com/jupyter/notebook.git@b44fc3b01dd1ae059170ab9ea657e34d44f5e36c

RUN pip3 install flask_socketio \
    flask_restplus \
    requests \
    jupyterlab \
    Werkzeug==0.16.1

RUN pip3 list

RUN rm /bin/sh && ln -s /bin/bash /bin/sh

RUN mkdir /root/.jupyter/
COPY jupyter_notebook_config.py /root/.jupyter/jupyter_notebook_config.py

RUN jupyter labextension install visual-tags

COPY ./app /app

