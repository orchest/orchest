# Ubuntu 18.04.1 LTS Bionic
FROM orchestsoftware/scipy-notebook-augmented

USER root

# Install our internal libraries
COPY ./lib /src
RUN pip3 install -e /src/orchest-internals/

RUN [ "mkdir", "/runner"]

WORKDIR /runner

COPY ./orchest/custom-images/runnable-images/run.py .
RUN ["chmod", "+x", "run.py"]

ENTRYPOINT [ "python3", "run.py"]
