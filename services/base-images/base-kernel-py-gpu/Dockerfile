# Base root container on cuda/cudnn enabled image
FROM orchest/kernel-py:2.3.0-gpu

USER root
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

RUN pip install -r requirements.txt

COPY ./runnable-shared/bootscript.sh /orchest/bootscript.sh

USER $NB_USER
ENV HOME=/home/$NB_USER

ARG ORCHEST_VERSION
ENV ORCHEST_VERSION=${ORCHEST_VERSION}

CMD [ "/orchest/bootscript.sh" ]
