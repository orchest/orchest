FROM python:3.8-slim
LABEL maintainer="Orchest B.V. https://www.orchest.io"

RUN apt-get update && \
    apt-get install -y curl make netcat && \
	curl -L https://get.helm.sh/helm-v3.8.0-linux-amd64.tar.gz | \
	tar -zxv && \
	mv linux-amd64/helm /usr/local/bin/helm && \
	rm linux-amd64 -rf && \
	curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && \
	install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl


COPY ./deploy /orchest/deploy

COPY ./ /orchest/services/orchest-ctl/

COPY ./lib /orchest/lib

WORKDIR /orchest/services/orchest-ctl

# Change user when installing packages to remove cache warnings.
RUN pip install .

ARG ORCHEST_VERSION
ENV ORCHEST_VERSION=${ORCHEST_VERSION}
ENTRYPOINT ["orchest"]
