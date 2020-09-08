# Ubuntu 18.04.1 LTS Bionic
FROM elyra/kernel-r:2.2.0rc2

USER root

RUN [ "mkdir", "/orchest"]
WORKDIR /orchest

COPY ./custom-base-kernel-r/*.sh /orchest/

# Run augment script
RUN ./augment-root.sh

# Install our internal libraries
RUN mkdir -p /home/jovyan/src
COPY ./lib/python /home/jovyan/src
RUN pip install -e /home/jovyan/src/orchest-internals/

# Copy run script
RUN [ "mkdir", "/runner"]
WORKDIR /runner

COPY ./runnable-shared/run.py /runner

# Start bootscript that starts kernel or runnable
COPY ./runnable-shared/bootscript.sh /orchest/bootscript.sh
CMD [ "/orchest/bootscript.sh" ]
