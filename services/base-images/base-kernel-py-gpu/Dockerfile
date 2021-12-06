# Base root container on cuda/cudnn enabled image
FROM orchest/kernel-py:2.3.0-gpu

USER root
# enable sudo for the NB_USER by default
RUN passwd -d $NB_USER && echo "$NB_USER   ALL=(ALL)   NOPASSWD:ALL" | tee /etc/sudoers.d/$NB_USER

WORKDIR /

COPY ./base-kernel-py-gpu/*.sh /

# Run augment script
RUN ./augment-root.sh

# Install our internal libraries
COPY ./lib/python /orchest/lib/python
COPY ./orchest-sdk /orchest/orchest-sdk

COPY ./runnable-shared/runner /orchest/services/base-images/runnable-shared/runner
WORKDIR /orchest/services/base-images/runnable-shared/runner

RUN chown $NB_USER -R /orchest/orchest-sdk
RUN chown $NB_USER -R /orchest/lib

USER $NB_USER
RUN pip install -r requirements-user.txt
# Install Orchest dependencies in our own environment
RUN conda create -y python=$(python --version | tr -d "Python ") -n orchestdependencies && \
    # requirements.txt includes local install and thus we need to use pip
    conda install -y -n orchestdependencies pip && \
    conda run -n orchestdependencies pip install -r requirements.txt

COPY ./runnable-shared/bootscript.sh /orchest/bootscript.sh

ENV HOME=/home/$NB_USER

# This path is searched first to locate kernels. Without this variable
# Jupyter will search inside the orchestdependencies environment first
# and end up using the wrong executable to start the kernel.
ENV JUPYTER_PATH=/opt/conda/share/jupyter

ARG ORCHEST_VERSION
ENV ORCHEST_VERSION=${ORCHEST_VERSION}

CMD [ "/orchest/bootscript.sh" ]
