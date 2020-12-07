# Ubuntu 18.04.1 LTS Bionic
FROM elyra/kernel-r:2.3.0
LABEL maintainer="Orchest B.V. https://www.orchest.io"

USER root

WORKDIR /

# mysql_config is required for orchest-sdk
COPY ./base-kernel-r/*.sh /

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
CMD [ "/orchest/bootscript.sh" ]
