# Ubuntu 18.04.1 LTS Bionic
FROM elyra/kernel-py:2.1.1

# Run augment script (augmenting scipy-notebook)
USER root
COPY augment.sh .
RUN chmod +x ./augment.sh

USER $NB_UID
RUN ./augment.sh