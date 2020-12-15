# Ubuntu 18.04.1 LTS Bionic
FROM elyra/kernel-py:2.3.0

USER root

WORKDIR /

COPY ./base-kernel-py/*.sh /

# Run augment script
RUN ./augment-root.sh

# Install our internal libraries
COPY ./lib/python /orchest/lib/python
COPY ./orchest-sdk /orchest/orchest-sdk

COPY ./runnable-shared/runner /orchest/services/base-images/runnable-shared/runner
WORKDIR /orchest/services/base-images/runnable-shared/runner

RUN pip install -r requirements.txt

COPY ./runnable-shared/bootscript.sh /orchest/bootscript.sh
ARG ORCHEST_VERSION
ENV ORCHEST_VERSION=${ORCHEST_VERSION}

RUN useradd orchest && passwd -d orchest && echo "orchest   ALL=(ALL)   NOPASSWD:ALL" | tee /etc/sudoers.d/orchest && \
    mkdir -p /home/orchest && \
    chown -R orchest:orchest /home/orchest
    
USER orchest
ENV HOME=/home/orchest

CMD [ "/orchest/bootscript.sh" ]
