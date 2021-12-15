FROM elyra/enterprise-gateway:2.5.2
LABEL maintainer="Orchest B.V. https://www.orchest.io"

# Overwrite the standard Python 3 kernel to indicate it should not
# be used in Orchest.
COPY ./kernel-override/ /opt/conda/share/jupyter/kernels/python3/

# Running as root is required to install the internal library.
COPY ./lib/python /orchest/lib/python
USER root
RUN pip3 install --upgrade pip && pip3 install -e /orchest/lib/python/orchest-internals

ARG ORCHEST_VERSION
ENV ORCHEST_VERSION=${ORCHEST_VERSION}
USER $NB_UID