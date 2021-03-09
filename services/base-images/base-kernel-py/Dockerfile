# Ubuntu 18.04.1 LTS Bionic
FROM elyra/kernel-py:2.3.0

USER root
# enable sudo for the NB_USER by default
RUN passwd -d $NB_USER && echo "$NB_USER   ALL=(ALL)   NOPASSWD:ALL" | tee /etc/sudoers.d/$NB_USER

WORKDIR /

COPY ./base-kernel-py/*.sh /

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
