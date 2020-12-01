# Base root container on cuda/cudnn enabled image
FROM orchest/kernel-py:2.2.0-gpu

USER root

WORKDIR /

COPY ./base-kernel-py-gpu/*.sh /

# Run augment script
RUN ./augment-root.sh

# Install our internal libraries
COPY ./lib /orchest/lib
COPY ./orchest-sdk /orchest/orchest-sdk

COPY ./runnable-shared/runner /orchest/services/base-images/runnable-shared/runner
WORKDIR /orchest/services/base-images/runnable-shared/runner

RUN pip install -r requirements.txt

COPY ./runnable-shared/bootscript.sh /orchest/bootscript.sh
CMD [ "/orchest/bootscript.sh" ]