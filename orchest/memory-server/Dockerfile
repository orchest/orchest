FROM python:3.7-slim

# Install git, because it is not included in the python-slim image.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && apt-get purge -y --auto-remove \
    && rm -rf /var/lib/apt/lists/*
ARG sdk_branch=master

# Installing the requirements here before copying, allows us to faster
# rebuild containers by using the cache.
RUN pip3 install git+https://github.com/orchest/orchest-sdk.git@${sdk_branch}#subdirectory=python \
    networkx==2.4

# Install our internal libraries
COPY ./lib /src
RUN pip3 install -e /src/orchest-internals/

COPY ./orchest/memory-server/app /app
WORKDIR /app
CMD ["python", "main.py"]
