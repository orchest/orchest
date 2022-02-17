FROM python:3.8-slim
LABEL maintainer="Orchest B.V. https://www.orchest.io"

COPY ./ /orchest/services/orchest-ctl/

COPY ./lib /orchest/lib

WORKDIR /orchest/services/orchest-ctl

# Change user when installing packages to remove cache warnings.
RUN pip install .

ARG ORCHEST_VERSION
ENV ORCHEST_VERSION=${ORCHEST_VERSION}
ENTRYPOINT ["orchest"]
