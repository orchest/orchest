FROM jupyter/r-notebook

USER root
COPY augment.sh .
RUN chmod +x ./augment.sh

USER $NB_UID
RUN ./augment.sh