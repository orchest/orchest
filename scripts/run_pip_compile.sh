#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

cd $DIR/../services/auth-server && pip-compile && cd -
cd $DIR/../services/orchest-webserver && pip-compile && cd -
cd $DIR/../services/jupyter-server && pip-compile && cd -
cd $DIR/../services/orchest-api && pip-compile && cd -
cd $DIR/../services/orchest-api && pip-compile requirements-dev.in && cd -
cd $DIR/../services/base-images/runnable-shared/runner && pip-compile && cd -
cd $DIR/../services/base-images/runnable-shared/runner && pip-compile requirements-dev.in && cd -
