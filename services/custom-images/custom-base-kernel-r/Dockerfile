# Ubuntu 18.04.1 LTS Bionic
FROM elyra/kernel-r:2.3.0

USER root

WORKDIR /

# mysql_config is required for orchest-sdk
COPY ./custom-base-kernel-r/*.sh /

# Run augment script
RUN ./augment-root.sh

# Install our internal libraries
COPY ./lib /orchest/lib
COPY ./orchest-sdk /orchest/orchest-sdk

COPY ./runnable-shared/runner /orchest/services/custom-images/runnable-shared/runner
WORKDIR /orchest/services/custom-images/runnable-shared/runner

RUN pip install -r requirements.txt

COPY ./runnable-shared/bootscript.sh /orchest/bootscript.sh
CMD [ "/orchest/bootscript.sh" ]