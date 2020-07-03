# Ubuntu 18.04.1 LTS Bionic
FROM elyra/kernel-py:2.1.1

# Run augment script (augmenting scipy-notebook)
USER root
COPY augment.sh .
RUN chmod +x ./augment.sh

COPY augment-root.sh .
RUN chmod +x ./augment-root.sh
RUN ./augment-root.sh

USER $NB_UID
ARG sdk_branch=master
RUN ./augment.sh ${sdk_branch}
