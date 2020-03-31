FROM tiangolo/uwsgi-nginx-flask:python3.7

RUN pip3 install flask_socketio flask_restplus requests jupyterlab

RUN mkdir /root/.jupyter/
COPY jupyter_notebook_config.py /root/.jupyter/jupyter_notebook_config.py

COPY ./app /app

