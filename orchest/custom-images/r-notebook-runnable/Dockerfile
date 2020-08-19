# Ubuntu 18.04.1 LTS Bionic
FROM orchestsoftware/r-notebook-augmented

USER root

# Install our internal libraries
COPY ./lib/python /src
RUN pip install -e /src/orchest-internals/

RUN [ "mkdir", "/runner"]

WORKDIR /runner

COPY ./orchest/custom-images/runnable-images-shared/run.py .
RUN ["chmod", "+x", "run.py"]

ENTRYPOINT [ "python", "run.py"]
