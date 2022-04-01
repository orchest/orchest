#!/bin/bash
set -e

# Get the user and group of the "orchest" shell script as this is most
# likely also the user that should own the files in the repository.
FILE_USER="$(ls -n /orchest-host/orchest | awk '{print $3}')"
FILE_GROUP="$(ls -n /orchest-host/orchest | awk '{print $4}')"

git fetch origin stale/pre-k8s-orchest

git checkout stale/pre-k8s-orchest

git pull origin stale/pre-k8s-orchest

# Change the user and group of all the files in the repository, except
# for the userdir.
ls -I userdir /orchest-host | xargs -I {} chown -R "$FILE_USER":"$FILE_GROUP" {}
