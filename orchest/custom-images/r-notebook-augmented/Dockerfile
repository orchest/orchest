FROM jupyter/r-notebook:04f7f60d34a6

USER root
COPY ./orchest/custom-images/r-notebook-augmented/augment.sh .
RUN chmod +x ./augment.sh

USER $NB_UID
ARG sdk_branch=master
RUN ./augment.sh ${sdk_branch}
