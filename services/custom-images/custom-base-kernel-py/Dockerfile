# Ubuntu 18.04.1 LTS Bionic
FROM elyra/kernel-py:2.2.0

USER root

RUN [ "mkdir", "/orchest"]
WORKDIR /orchest

COPY ./custom-base-kernel-py/*.sh /orchest/

# Run augment script
RUN ./augment-root.sh

# Install our internal libraries
COPY ./runnable-shared/runner /orchest/services/custom-images/runnable-shared/runner
WORKDIR /orchest/services/custom-images/runnable-shared/runner

RUN pip install -e requirements.txt

COPY ./runnable-shared/bootscript.sh /orchest/bootscript.sh
CMD [ "/orchest/bootscript.sh" ]