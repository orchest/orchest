#!/bin/bash

# This script can be used to access the migration managers of the auth,
# orchest-webserver and orchest-api services.

if [ $# -eq 0 ]; then
    echo "missing first argument: service"
    exit 1
fi
SERVICE=$1
if [ "${SERVICE}" = "orchest-api" ] || 
   [ "${SERVICE}" = "orchest-webserver" ] ||
   [ "${SERVICE}" = "auth-server" ]; then
  SERVICE=$1
  shift
else
  echo "Service ${SERVICE} is invalid. Can be orchest-api, orchest-webserver, auth-server."
  exit 1
fi

# the rest of the commands will be passed to the migration script of the
# service
COMMANDS="${@}"
docker exec ${SERVICE} python migration_manager.py db ${COMMANDS}
code=$?
if [ $code -eq 0 ]; then
  # cp the revision files to the filesystem, this way the script works
  # both in production and dev mode
  DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
  docker cp \
  "${SERVICE}:/orchest/services/${SERVICE}/app/migrations/versions/" \
  "${DIR}/../services/${SERVICE}/app/migrations/"

  code=$?
  if [ $code -eq 0 ]; then
    echo "Remember to check the newly generated revision for correctness."
  fi
fi
