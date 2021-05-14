FROM python:3.8-slim
LABEL maintainer="Orchest B.V. https://www.orchest.io"

# refresh SSL certificates
RUN apt-get update && apt-get install -y git curl jq ca-certificates && update-ca-certificates --fresh

# install nodejs for jupyterextension install support
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash - && apt-get install -y nodejs

# Swap dash for normal bash to get more full fledged terminal session in Jupyter
RUN rm /bin/sh && ln -s /bin/bash /bin/sh

# Install Jupyter Lab
COPY ./requirements.txt .
RUN pip3 install pip --upgrade && \
    pip3 install -r requirements.txt

# Get our custom extensions for jupyterlab.
ARG extension_dir=/jupyterlab-orchest-build
ARG pip_jupyter_extension_dir=/usr/local/share/jupyter/lab/extensions
RUN git clone https://github.com/orchest/visual-tags.git /jupyter-extensions/visual-tags \
    && git clone https://github.com/orchest/orchest-integration.git /jupyter-extensions/orchest-integration \
    && jupyter labextension install /jupyter-extensions/visual-tags \
        --no-build \
        --BaseExtensionApp.app_dir=$extension_dir \
    && jupyter labextension install /jupyter-extensions/orchest-integration \
        --no-build \
        --BaseExtensionApp.app_dir=$extension_dir \
    && pip3 install jupyterlab-git==0.30.1 \
    && cp -rfT $pip_jupyter_extension_dir $extension_dir/extensions \
    && jupyter lab build --dev-build=False --LabBuildApp.app_dir=$extension_dir \
    && jupyter lab clean --LabCleanApp.app_dir=$extension_dir

COPY ./jupyter_server_config.py /root/.jupyter/jupyter_server_config.py

# Display warning message when running `pip` or `pip3` in the Jupyter
# terminal.
COPY patch-pip.sh pip-warning.py /
RUN bash /patch-pip.sh

# Hardcoded /project-dir because Python config can't be injected into Dockerfile
WORKDIR /project-dir

ARG ORCHEST_VERSION
ENV ORCHEST_VERSION=${ORCHEST_VERSION}

COPY start.sh /
ENTRYPOINT [ "/start.sh" ]
