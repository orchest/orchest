#!/bin/bash

# This script can be used to access the migration managers of the auth,
# orchest-webserver and orchest-api services.
usage () {
  echo "Usage:"
  echo -e "\e[34mmigration_manager.sh <service-name> <action> <optional action related args>\e[39m"
  echo -e "service-name can be one of: \e[32morchest-api, orchest-webserver, auth-server\e[39m"
  echo
  echo "Requires kubectl."
  echo "It can be helpful to run orchest with --dev"
  echo
  echo "Examples: "
  echo "To initialize the migrations directory (already part of the repo):"
  echo "    migration_manager.sh orchest-api init"
  echo "To create a revision file based on the difference between the db and the schema"
  echo -e "    \e[34mmigration_manager.sh orchest-api migrate\e[39m"
  echo "To upgrade the db to the latest revision file (HEAD)"
  echo "    migration_manager.sh orchest-api upgrade"
  echo "To downgrade the db by 1 revision"
  echo "    migration_manager.sh orchest-api downgrade"
  echo "You are likely to use only migrate, for more info visit https://flask-migrate.readthedocs.io/en/latest/"
  echo "If migrate is used, the service revisions are copied locally in the repo."
}

if [ $# -eq 0 ]; then
    echo "missing first argument: service"
    usage
    exit 1
fi
SERVICE=$1
if [ "${SERVICE}" = "orchest-api" ] ||
   [ "${SERVICE}" = "orchest-webserver" ] ||
   [ "${SERVICE}" = "auth-server" ]; then
  SERVICE=$1
  shift
  # Check if the user actually added a migration command, init, migrate,
  # etc.
  if [ $# -eq 0 ]; then
      usage
      exit 1
  fi
else
  usage
  exit 1
fi

# Get the pod to which command & cp will be issued.
pod_name=$(kubectl get pods -n orchest -l controller.orchest.io/component=${SERVICE} \
    --field-selector=status.phase=Running --no-headers \
    --output=jsonpath={.items..metadata.name})

# The rest of the commands will be passed to the migration script of the
# service.
COMMANDS="${@}"

if [ "${SERVICE}" = "orchest-webserver" ]; then
  kubectl exec -n orchest ${pod_name} -c orchest-webserver \
    -- sh -c "FLASK_APP=migration_manager.py flask db ${COMMANDS}"
else
  kubectl exec -n orchest ${pod_name} -- python migration_manager.py db ${COMMANDS}
fi
code=$?

if [ $code -eq 0 ] && [ ${COMMANDS} = "migrate" ]; then
  # Copy the revision files to the filesystem, this way the script works
  # both with or without --dev.
  DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
  kubectl cp \
  "orchest/${pod_name}:/orchest/services/${SERVICE}/app/migrations/versions" \
  "${DIR}/../services/${SERVICE}/app/migrations/versions" \
  > /dev/null
  # Sending cp to /dev/null because of this issue:
  # https://github.com/kubernetes/kubernetes/issues/58692.

  code=$?
  if [ $code -eq 0 ]; then
    echo -e "\e[91m\e[5mRemember to check the newly generated revision for correctness.\e[39m"
  fi
fi
