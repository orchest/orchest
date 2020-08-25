FROM jupyter/minimal-notebook:04f7f60d34a6

RUN python3 -m pip install docker

USER root

COPY ./orchest/orchest-ctl/app /app

WORKDIR /app

ENTRYPOINT ["python3", "main.py"]
