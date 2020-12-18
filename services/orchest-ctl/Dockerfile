FROM python:3.7-slim
LABEL maintainer="Orchest B.V. https://www.orchest.io"

# Install `git` as it's used by update procedure
RUN apt-get update && apt-get install -y git

COPY ./ /orchest/services/orchest-ctl/

WORKDIR /orchest/services/orchest-ctl

# Change user when installing packages to remove cache warnings.
RUN pip install .

ARG ORCHEST_VERSION
ENV ORCHEST_VERSION=${ORCHEST_VERSION}
ENTRYPOINT ["orchest"]
