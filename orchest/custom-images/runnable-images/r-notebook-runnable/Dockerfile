# Ubuntu 18.04.1 LTS Bionic
FROM orchestsoftware/r-notebook-augmented

USER root

RUN [ "mkdir", "/runner"]

WORKDIR /runner

COPY run.py .

RUN ["chmod", "+x", "run.py"]

ENTRYPOINT [ "python3", "run.py"]