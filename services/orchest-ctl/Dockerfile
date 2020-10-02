FROM jupyter/minimal-notebook:04f7f60d34a6

RUN python3 -m pip install docker aiodocker

USER root

RUN mkdir -p /orchest/services/orchest-ctl
COPY ./ /orchest/services/orchest-ctl/

WORKDIR /orchest/services/orchest-ctl/app

ENTRYPOINT ["python3", "main.py"]
