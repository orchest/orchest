FROM jupyter/r-notebook

USER root
COPY augment.sh .
RUN chmod +x ./augment.sh

USER $NB_UID
ARG sdk_branch=master
RUN ./augment.sh ${sdk_branch}
