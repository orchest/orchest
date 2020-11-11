#!/bin/bash

# Explicitely use HTTPS so that we do not get the error:
# "error: cannot run ssh: No such file or directory"
# It is caused when the remote "origin" uses SSH.
git pull https://github.com/orchest/orchest.git --rebase
