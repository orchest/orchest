##########################
# Compile stage
FROM golang:1.18.2 AS build-env
LABEL maintainer="Orchest B.V. https://www.orchest.io"

RUN apt-get update && \
	curl -L https://get.helm.sh/helm-v3.8.0-linux-amd64.tar.gz | \
	tar -zxv && \
	mv linux-amd64/helm /usr/local/bin/helm

ARG ORCHEST_VERSION
ENV ORCHEST_VERSION=${ORCHEST_VERSION}	

ENV GO111MODULE on
WORKDIR /go/src/github.com/orchest/orchest/services/orchest-controller
ADD . .

RUN	make controller
##########################
# Final stage
FROM alpine:3.14.6

# Allow delve to run on Alpine based containers.
RUN apk add --no-cache libc6-compat

WORKDIR /usr/bin

COPY --from=build-env /usr/local/bin/helm /usr/local/bin/helm

COPY --from=build-env /go/src/github.com/orchest/orchest/services/orchest-controller/bin/controller .

COPY ./deploy /deploy

# Run the controller
ENTRYPOINT ["controller"]
