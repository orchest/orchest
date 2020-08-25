# Ubuntu 18.04.1 LTS Bionic
FROM elyra/kernel-py:2.2.0rc2

USER root

RUN [ "mkdir", "/orchest"]

WORKDIR /orchest

COPY ./custom-base-kernel-py/*.sh /orchest/
COPY ./runnable-shared/bootscript.sh /orchest/bootscript.sh

# Run augment script
ARG sdk_branch=master
RUN ./augment-root.sh ${sdk_branch}
RUN ./augment.sh ${sdk_branch}

# Install our internal libraries
USER root
RUN mkdir -p /home/jovyan/src
COPY ./lib/python /home/jovyan/src
RUN pip install -e /home/jovyan/src/orchest-internals/

# Copy run script
RUN [ "mkdir", "/runner"]
WORKDIR /runner

COPY ./runnable-shared/run.py /runner
RUN ["chmod", "+x", "run.py"]

USER $NB_UID

# Start bootscript that starts kernel or runnable
CMD [ "/orchest/bootscript.sh" ]