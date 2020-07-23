FROM jupyter/scipy-notebook

LABEL maintainer="Orchest <info@orchest.io>"

USER root
COPY ./orchest/custom-images/scipy-notebook-augmented/augment.sh .
RUN chmod +x ./augment.sh

COPY ./orchest/custom-images/scipy-notebook-augmented/augment-root.sh .
RUN chmod +x ./augment-root.sh
RUN ./augment-root.sh

USER $NB_UID
ARG sdk_branch=master
RUN ./augment.sh ${sdk_branch}
