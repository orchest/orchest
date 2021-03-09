# Ubuntu 18.04.1 LTS Bionic
FROM orchest/kernel-julia:2.3.0
LABEL maintainer="Orchest B.V. https://www.orchest.io"

USER root
# enable sudo for the NB_USER by default
RUN passwd -d $NB_USER && echo "$NB_USER   ALL=(ALL)   NOPASSWD:ALL" | tee /etc/sudoers.d/$NB_USER

WORKDIR /

# mysql_config is required for orchest-sdk
COPY ./base-kernel-julia/*.sh /

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
RUN pip install -r requirements.txt

COPY ./runnable-shared/bootscript.sh /orchest/bootscript.sh

ENV HOME=/home/$NB_USER

ARG ORCHEST_VERSION
ENV ORCHEST_VERSION=${ORCHEST_VERSION}

CMD [ "/orchest/bootscript.sh" ]
