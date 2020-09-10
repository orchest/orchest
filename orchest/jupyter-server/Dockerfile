FROM tiangolo/uwsgi-nginx-flask:python3.7

# refresh SSL certificates
RUN apt-get update && apt-get install -y ca-certificates && update-ca-certificates --fresh
# install nodejs for jupyterextension install support
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash - && apt-get install -y nodejs

RUN pip3 install git+https://github.com/jupyter/notebook.git@b44fc3b01dd1ae059170ab9ea657e34d44f5e36c
RUN pip3 install flask_socketio \
    flask_restplus \
    requests \
    Werkzeug==0.16.1

# pull JupyterLab and apply patches
RUN mkdir /custom-pip
WORKDIR /custom-pip
RUN git clone  --branch v2.1.4 https://github.com/jupyterlab/jupyterlab.git
COPY ./patches/* /custom-pip/jupyterlab/
WORKDIR /custom-pip/jupyterlab/
RUN git config --global user.email "ricklamers@gmail.com" ; \
    git config --global user.name "Rick Lamers"
RUN git am < 0001-Reconnect-a-websocket-when-a-kernel-is-restarted.patch
RUN pip3 install -e .
RUN mkdir /jupyter-extensions/

RUN git clone https://github.com/orchest/visual-tags.git /jupyter-extensions/visual-tags
RUN jlpm run add:sibling /jupyter-extensions/visual-tags

RUN git clone https://github.com/orchest/orchest-integration.git /jupyter-extensions/orchest-integration
RUN jlpm run add:sibling /jupyter-extensions/orchest-integration

RUN jlpm run build

RUN jupyter labextension install /jupyter-extensions/visual-tags
RUN jupyter labextension install /jupyter-extensions/orchest-integration
RUN cp -r /custom-pip/jupyterlab/dev_mode/* /usr/local/share/jupyter/lab/

# Swap dash for normal bash to get more full fledged terminal session in Jupyter
RUN rm /bin/sh && ln -s /bin/bash /bin/sh

RUN mkdir /root/.jupyter/
COPY ./jupyter_notebook_config.py /root/.jupyter/jupyter_notebook_config.py

# TODO: Make the jupyter-server use the internal library. Do this once
#       JupyterLab has a stable 3.0 version as this also no longer
#       requires the patch.
COPY ./app /app
