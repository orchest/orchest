#!/bin/bash
set -e

[ "$(git rev-parse --abbrev-ref HEAD)" != "master" ] && exit 21

# Get the user and group of the "orchest" shell script as this is most
# likely also the user that should own the files in the repository.
FILE_USER="$(ls -n /orchest-host/orchest | awk '{print $3}')"
FILE_GROUP="$(ls -n /orchest-host/orchest | awk '{print $4}')"

# Explicitely use HTTPS so that we do not get the error:
# "error: cannot run ssh: No such file or directory"
# It is caused when the remote "origin" uses SSH.
git pull https://github.com/orchest/orchest.git --rebase
# explicitly fetch tags
git fetch https://github.com/orchest/orchest.git --tags

# Change the user and group of all the files in the repository, except
# for the userdir.
ls -I userdir /orchest-host | xargs -I {} chown -R "$FILE_USER":"$FILE_GROUP" {}
