# Ubuntu 18.04.1 LTS Bionic
FROM elyra/kernel-r:2.2.0rc2

RUN [ "mkdir", "/orchest"]
WORKDIR /orchest

COPY ./orchest/custom-images/custom-base-kernel-r/augment.sh .
COPY ./orchest/custom-images/runnable-images-shared/bootscript.sh .

# Run augment script
USER $NB_UID
ARG sdk_branch=master
RUN ./augment.sh ${sdk_branch}

# Install our internal libraries
USER root
COPY ./lib/python /src
RUN pip install -e /src/orchest-internals/

# Copy run script
RUN [ "mkdir", "/runner"]
WORKDIR /runner

COPY ./orchest/custom-images/runnable-images-shared/run.py .
RUN ["chmod", "+x", "run.py"]

USER $NB_UID

# Start bootscript that starts kernel or runnable
CMD [ "/orchest/bootscript.sh" ]