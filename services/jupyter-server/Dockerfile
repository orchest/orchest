FROM python:3.7-slim

# refresh SSL certificates
RUN apt-get update && apt-get install -y git curl ca-certificates && update-ca-certificates --fresh
# install nodejs for jupyterextension install support
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash - && apt-get install -y nodejs

# Swap dash for normal bash to get more full fledged terminal session in Jupyter
RUN rm /bin/sh && ln -s /bin/bash /bin/sh

# Install Jupyter Lab
RUN pip3 install pip --upgrade
RUN pip3 install jupyterlab==3.0.0rc9 \
    flask_socketio \
    flask_restplus \
    requests \
    Werkzeug==0.16.1

COPY ./patch/handlers.py /usr/local/lib/python3.7/site-packages/jupyter_server/gateway/handlers.py

RUN git clone --single-branch --branch jupyterlab3 https://github.com/orchest/visual-tags.git /jupyter-extensions/visual-tags
RUN git clone --single-branch --branch jupyterlab3 https://github.com/orchest/orchest-integration.git /jupyter-extensions/orchest-integration

RUN jupyter labextension install /jupyter-extensions/visual-tags --no-build
RUN jupyter labextension install /jupyter-extensions/orchest-integration

RUN mkdir /root/.jupyter/
COPY ./jupyter_server_config.py /root/.jupyter/jupyter_server_config.py


ENTRYPOINT [ "jupyter", "lab" ]