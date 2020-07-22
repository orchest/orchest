# Ubuntu 18.04.1 LTS Bionic
FROM elyra/kernel-r:2.1.1

# Run augment script (augmenting r-notebook)
USER root
COPY ./orchest/custom-images/r-notebook-augmented/augment.sh .
RUN chmod +x ./augment.sh

USER $NB_UID
ARG sdk_branch=master
RUN ./augment.sh ${sdk_branch}
