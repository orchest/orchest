# Ubuntu 18.04.1 LTS Bionic
FROM elyra/kernel-py:2.2.0rc2

# Run augment script (augmenting scipy-notebook)
USER root
COPY ./orchest/custom-images/scipy-notebook-augmented/augment.sh .
RUN chmod +x ./augment.sh

COPY ./orchest/custom-images/scipy-notebook-augmented/augment-root.sh .
RUN chmod +x ./augment-root.sh
RUN ./augment-root.sh

USER $NB_UID
ARG sdk_branch=master
RUN ./augment.sh ${sdk_branch}
