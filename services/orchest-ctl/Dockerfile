FROM jupyter/minimal-notebook:04f7f60d34a6

# Install `git` as it's used by update procedure
USER root
RUN apt-get update && apt-get install -y git

COPY ./ /orchest/services/orchest-ctl/

WORKDIR /orchest/services/orchest-ctl

# Change user when installing packages to remove cache warnings.
USER $NB_UID
RUN pip install .
USER root

ENTRYPOINT ["orchest"]
