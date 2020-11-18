FROM python:3.7-slim
LABEL maintainer="Orchest B.V. https://www.orchest.io"

# refresh SSL certificates
RUN apt-get update && apt-get install -y git curl ca-certificates && update-ca-certificates --fresh

# install nodejs for jupyterextension install support
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash - && apt-get install -y nodejs

# Swap dash for normal bash to get more full fledged terminal session in Jupyter
RUN rm /bin/sh && ln -s /bin/bash /bin/sh

COPY ./requirements.txt requirements.txt

# Install Jupyter Lab
RUN pip3 install pip --upgrade && \
    pip3 install -r requirements.txt

COPY ./patch/handlers.py /usr/local/lib/python3.7/site-packages/jupyter_server/gateway/handlers.py

RUN git clone --single-branch --branch jupyterlab3 https://github.com/orchest/visual-tags.git /jupyter-extensions/visual-tags && \
    git clone --single-branch --branch jupyterlab3 https://github.com/orchest/orchest-integration.git /jupyter-extensions/orchest-integration && \
    jupyter labextension install /jupyter-extensions/visual-tags --no-build && \
    jupyter labextension install /jupyter-extensions/orchest-integration

COPY ./jupyter_server_config.py /root/.jupyter/jupyter_server_config.py

ENTRYPOINT [ "jupyter", "lab" ]