FROM tiangolo/uwsgi-nginx-flask:python3.7

# refresh SSL certificates
RUN apt-get update && apt-get install -y ca-certificates && update-ca-certificates --fresh
# install nodejs for jupyterextension install support
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash - && apt-get install -y nodejs

RUN pip3 install jupyterlab==3.0.0rc8
RUN pip3 install flask_socketio \
    flask_restplus \
    requests \
    Werkzeug==0.16.1

RUN git clone --single-branch --branch jupyterlab3 https://github.com/orchest/visual-tags.git /jupyter-extensions/visual-tags
RUN git clone --single-branch --branch jupyterlab3 https://github.com/orchest/orchest-integration.git /jupyter-extensions/orchest-integration

RUN jupyter labextension install /jupyter-extensions/visual-tags --no-build
RUN jupyter labextension install /jupyter-extensions/orchest-integration

# Swap dash for normal bash to get more full fledged terminal session in Jupyter
RUN rm /bin/sh && ln -s /bin/bash /bin/sh

RUN mkdir /root/.jupyter/
COPY ./jupyter_lab_config.py /root/.jupyter/jupyter_lab_config.py

COPY ./app /app