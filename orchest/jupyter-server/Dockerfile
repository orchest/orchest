FROM tiangolo/uwsgi-nginx-flask:python3.7

RUN pip3 install flask_socketio flask_restplus requests jupyterlab==2.0.2 Werkzeug==0.16.1

RUN rm /bin/sh && ln -s /bin/bash /bin/sh

RUN mkdir /root/.jupyter/
COPY jupyter_notebook_config.py /root/.jupyter/jupyter_notebook_config.py

COPY ./app /app

