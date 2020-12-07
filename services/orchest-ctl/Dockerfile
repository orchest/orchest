FROM jupyter/minimal-notebook:04f7f60d34a6
LABEL maintainer="Orchest B.V. https://www.orchest.io"

# Install `git` as it's used by update procedure
USER root
RUN apt-get update && apt-get install -y git

COPY ./ /orchest/services/orchest-ctl/

WORKDIR /orchest/services/orchest-ctl

# Change user when installing packages to remove cache warnings.
USER $NB_UID
RUN pip install .
USER root

ARG ORCHEST_VERSION
ENV ORCHEST_VERSION=${ORCHEST_VERSION}
ENTRYPOINT ["orchest"]
