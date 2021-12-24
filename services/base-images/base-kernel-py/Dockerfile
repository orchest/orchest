# Ubuntu 18.04.1 LTS Bionic
FROM elyra/kernel-py:2.5.2
LABEL maintainer="Orchest B.V. https://www.orchest.io"

# --------------------------------------------------
# All lines below are the same for all base-kernel-* images that we
# have. Due to how Docker works we sadly have to copy it into every
# Dockerfile (instead of a DRY solution), you can read more here:
# https://github.com/moby/moby/issues/3378
# --------------------------------------------------
USER root

RUN apt-get update \
    && apt-get install default-libmysqlclient-dev sudo -y

# enable sudo for the NB_USER by default
RUN passwd -d $NB_USER && echo "$NB_USER   ALL=(ALL)   NOPASSWD:ALL" | tee /etc/sudoers.d/$NB_USER

# Get all requirements in place.
COPY ./runnable-shared/runner/requirements* /orchest/services/base-images/runnable-shared/runner/
COPY ./lib/python /orchest/lib/python
COPY ./orchest-sdk /orchest/orchest-sdk
RUN chown $NB_USER -R /orchest/orchest-sdk \
    && chown $NB_USER -R /orchest/lib

USER $NB_USER

# Install requirements.
WORKDIR /orchest/services/base-images/runnable-shared/runner
RUN pip install -r requirements-user.txt
# Install Orchest dependencies in our own environment
RUN conda create -y python=$(python --version | tr -d "Python ") -n orchestdependencies \
    # requirements.txt includes local install and thus we need to use pip
    && eval "$(conda shell.bash hook)" \
    && conda activate orchestdependencies \
    && pip install -r requirements.txt \
    && conda deactivate

# Get application files.
COPY ./runnable-shared/runner /orchest/services/base-images/runnable-shared/runner

# This path is searched first to locate kernels. Without this variable
# Jupyter will search inside the orchestdependencies environment first
# and end up using the wrong executable to start the kernel.
ENV JUPYTER_PATH=/opt/conda/share/jupyter
ENV HOME=/home/$NB_USER

# Environment variable that can be set to specify the conda environment
# to use to start Jupyter kernels.
ENV CONDA_ENV="base"

ARG ORCHEST_VERSION
ENV ORCHEST_VERSION=${ORCHEST_VERSION}

COPY ./runnable-shared/bootscript.sh /orchest/bootscript.sh
CMD [ "/orchest/bootscript.sh" ]
