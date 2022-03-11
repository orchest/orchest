# Ubuntu 20.04.1 LTS Focal
FROM jupyter/base-notebook:2022-03-09
LABEL maintainer="Orchest B.V. https://www.orchest.io"

# Enterprise gateway stuff
ENV PATH=$PATH:$CONDA_DIR/bin

RUN mamba install --quiet --yes \
    cffi \
    ipykernel \
    ipython \
    'jupyter_client<7' \
    future \
    pycryptodomex && \
    mamba clean --all && \
    fix-permissions $CONDA_DIR && \
    fix-permissions /home/$NB_USER

# Get Enterprise Gateway kernel files.
USER root
WORKDIR /usr/local/bin
RUN wget https://github.com/jupyter-server/enterprise_gateway/releases/download/v2.5.2/jupyter_enterprise_gateway_kernel_image_files-2.5.2.tar.gz -O kernel_image_files.tar.gz \
    && tar -xf kernel_image_files.tar.gz \
    && rm -rf kernel_image_files.tar.gz kernel-launchers/scala \
    && chown jovyan:users /usr/local/bin/bootstrap-kernel.sh \
    && chmod 0755 /usr/local/bin/bootstrap-kernel.sh \
    && chown -R jovyan:users /usr/local/bin/kernel-launchers

USER root

# defailt-libmysqlclient-dev : Orchest dependency
# libkrb5-dev                : Enterprise Gateway requirement
RUN apt-get update \
    && apt-get install -yq --no-install-recommends default-libmysqlclient-dev libkrb5-dev \
    && rm -rf /var/lib/apt/lists/*

# enable sudo for the NB_USER by default
RUN passwd -d $NB_USER && echo "$NB_USER   ALL=(ALL)   NOPASSWD:ALL" | tee /etc/sudoers.d/$NB_USER

# Get all requirements in place.
COPY ./runnable-shared/runner/requirements* /orchest/services/base-images/runnable-shared/runner/
COPY ./lib/python /orchest/lib/python
COPY ./orchest-sdk /orchest/orchest-sdk
RUN chown $NB_USER -R /orchest/orchest-sdk \
    && chown $NB_USER -R /orchest/lib

USER $NB_USER

# Install requirements on base conda environment
WORKDIR /orchest/services/base-images/runnable-shared/runner
RUN pip install -r requirements-user.txt --no-cache
# Install Orchest dependencies in our own environment so they are
# completely isolated from user dependencies. Using a venv instead
# of conda environment because it is much smaller.
RUN python -m venv /home/$NB_USER/venv \
    && source /home/$NB_USER/venv/bin/activate \
    && pip install -r requirements.txt --no-cache \
    && deactivate

# Get application files.
COPY ./runnable-shared/runner /orchest/services/base-images/runnable-shared/runner

# This path is searched first to locate kernels. Without this variable
# Jupyter will search inside the orchestdependencies environment first
# and end up using the wrong executable to start the kernel.
ENV JUPYTER_PATH=/opt/conda/share/jupyter
ENV HOME=/home/$NB_USER

# Orchest related environment variable that can be set to specify the
# conda environment to use to start Jupyter kernels.
ENV CONDA_ENV="base"

# Set a default renderer for plotly that actually renders in JupyterLab.
ENV PLOTLY_RENDERER="iframe"

# Required by the Enterprise Gateway to launch an ipykernel.
ENV KERNEL_LANGUAGE="python"

ARG ORCHEST_VERSION
ENV ORCHEST_VERSION=${ORCHEST_VERSION}

COPY ./runnable-shared/bootscript.sh /orchest/bootscript.sh
CMD [ "/orchest/bootscript.sh" ]
