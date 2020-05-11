FROM jupyter/scipy-notebook

LABEL maintainer="Orchest <info@orchest.io>"

USER root
COPY augment.sh .
RUN chmod +x ./augment.sh

USER $NB_UID
RUN ./augment.sh