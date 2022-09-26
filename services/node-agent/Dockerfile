FROM python:3.9-slim
LABEL maintainer="Orchest B.V. https://www.orchest.io"

RUN apt-get update -y && apt-get install curl -y

WORKDIR /tmp/download

ARG CONTAINERD_VERSION="1.6.4"
ENV CONTAINERD_DOWNLOAD_URL="https://github.com/containerd/containerd/releases/download/v$CONTAINERD_VERSION/containerd-$CONTAINERD_VERSION-linux-amd64.tar.gz"

# Install Buildah. This is needed to pull and push images without ssl
# verification for container runtimes which don't allow interacting with
# insecure registries by default and for which the ssl certificates
# injection did not fix the issue, like in kubernetes for docker for
# desktop.
RUN apt-get update \
    && apt-get install -yq --no-install-recommends buildah \
    && buildah version \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install containerd.
RUN curl -L $CONTAINERD_DOWNLOAD_URL --output containerd-$CONTAINERD_VERSION-linux-amd64.tar.gz \
    && tar zxvf containerd-$CONTAINERD_VERSION-linux-amd64.tar.gz -C /tmp/download \
    && mv /tmp/download/bin/ctr /usr/local/bin

# Install crictl.
ARG CRICTL_VERSION="v1.24.1"
ENV CRICTL_DOWNLOAD_URL=https://github.com/kubernetes-sigs/cri-tools/releases/download/$CRICTL_VERSION/crictl-$CRICTL_VERSION-linux-amd64.tar.gz
RUN curl -L $CRICTL_DOWNLOAD_URL --output crictl-$CRICTL_VERSION-linux-amd64.tar.gz \
    && tar zxvf crictl-$CRICTL_VERSION-linux-amd64.tar.gz -C /tmp/download  \
    && mv /tmp/download/crictl /usr/local/bin

WORKDIR /orchest/services/node-agent/
RUN rm -rf /tmp/download

# Get all Python requirements in place and install them.
COPY ./requirements.txt ./
COPY ./lib /orchest/lib

RUN pip3 install -r requirements.txt


COPY . ./

CMD [ "python3", "./app/main.py" ]
ARG ORCHEST_VERSION
ENV ORCHEST_VERSION=${ORCHEST_VERSION}
