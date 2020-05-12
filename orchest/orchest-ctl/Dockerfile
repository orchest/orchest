FROM jupyter/base-notebook

RUN python3 -m pip install docker

USER root

COPY ./app /app

WORKDIR /app

ENTRYPOINT ["python3", "main.py"]