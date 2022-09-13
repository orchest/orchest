# Ubuntu 20.04.1 LTS Focal
FROM orchest/kernel-julia:2.5.2
LABEL maintainer="Orchest B.V. https://www.orchest.io"

# --------------------------------------------------
# All lines below are the same for all base-kernel-* images that we
# have. Due to how Docker works we sadly have to copy it into every
# Dockerfile (instead of a DRY solution), you can read more here:
# https://github.com/moby/moby/issues/3378
# --------------------------------------------------
USER root

RUN apt-get update \
    && apt-get install openssh-server git default-libmysqlclient-dev sudo -y

RUN passwd -d $NB_USER \
    # Enable `sudo` for the $NB_USER by default.
    && echo "$NB_USER   ALL=(ALL)   NOPASSWD:ALL" | tee /etc/sudoers.d/$NB_USER \
    # Persist the value of `DEBIAN_FRONTEND` when running with `sudo`,
    # so that installing packages works as expected.
    && echo "Defaults env_keep += \"DEBIAN_FRONTEND\"" | tee --append /etc/sudoers.d/$NB_USER \
    # All files in this directory should be mode 0440.
    && chmod 0440 /etc/sudoers.d/$NB_USER

# Get all requirements in place.
COPY ./runnable-shared/runner/requirements* /orchest/services/base-images/runnable-shared/runner/
COPY ./lib/python /orchest/lib/python
COPY ./orchest-sdk /orchest/orchest-sdk
RUN chown $NB_USER -R /orchest/orchest-sdk \
    && chown $NB_USER -R /orchest/lib && \
    echo -e "jovyan\njovyan" | passwd jovyan


USER $NB_USER

# Install requirements on base environment
WORKDIR /orchest/services/base-images/runnable-shared/runner
RUN pip install -r requirements-user.txt

# Install Orchest dependencies in our own environment so they are
# completely isolated from user dependencies. Use a venv instead
# of conda environment because it is much smaller.
RUN python -m venv /home/$NB_USER/venv \
    && source /home/$NB_USER/venv/bin/activate \
    && pip install -r requirements.txt --no-cache \
    && deactivate

# Empty configuration file for kernel initialization
RUN touch /home/jovyan/.orchestrc && \
    echo "export PS1='\${ENVIRONMENT_SHELL_NAME:+(\$ENVIRONMENT_SHELL_NAME)}\[\033[01;32m\]\u\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ '" >> ~/.bashrc

# Get application files.
COPY ./runnable-shared/runner /orchest/services/base-images/runnable-shared/runner

# This path is searched first to locate kernels. Without this variable
# Jupyter will search inside the orchestdependencies environment first
# and end up using the wrong executable to start the kernel.
ENV JUPYTER_PATH=/opt/conda/share/jupyter
ENV HOME=/home/$NB_USER
ENV BASH_ENV=/home/jovyan/.orchestrc


# Environment variable that can be set to specify the conda environment
# to use to start Jupyter kernels.
ENV CONDA_ENV="base"

ARG ORCHEST_VERSION
ENV ORCHEST_VERSION=${ORCHEST_VERSION}

# Set a default renderer for plotly that actually renders in JupyterLab.
ENV PLOTLY_RENDERER="iframe"

COPY ./runnable-shared/bootscript.sh /orchest/bootscript.sh
CMD [ "/orchest/bootscript.sh" ]
