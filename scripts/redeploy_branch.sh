#!/bin/bash
# Ths script will:
# - checkout the given branch
# - store the existing auth users
# - uninstall Orchest
# - install the orchest-cli from the given branch
# - install Orchest
# - restore the existing auth users
# - set cloud mode, enable auth 
# - build the minimal set of imagand restartes to run Orchest, using the
#   current cluster version
# - restart
#
# The script is not battle proof, but an incremental movement towards
# being able to easily switch around branches to review them.  This is
# currently used for our internal preview instances. The script assumes
# Orchest to be already installed.
#
# TLDR: redeploy Orchest for a given branch, maintain auth users.

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

if [[ ! $# -eq 1 ]] ; then
    echo "Please specify a branch, e.g. 'bash scripts/redeploy_branch.sh dev'"
    exit 1
fi

set -e

echo "Checking out branch ${1}..."
git fetch --all
git checkout $1
git pull origin $1


# Needed to get the auth users.
orchest start

echo "Storing auth users for later..."
AUTH_USERS_DUMP=$(minikube kubectl -- exec -it -n orchest deploy/orchest-database -- \
    pg_dump -U postgres --column-inserts --data-only -t users -d auth_server)

orchest uninstall

echo "Installing the orchest-cli from this branch..."
pip install "${DIR}/../orchest-cli" > /dev/null

orchest install

echo "Restoring auth users..."
# Needed because some rows contain dollar symbols, perhaps we should
# just dump to a .sql file and copy it around from the pod to the host
# and viceversa if more issues come up.
AUTH_USERS_DUMP="${AUTH_USERS_DUMP//$/\\$}"
minikube kubectl -- exec -n orchest deploy/orchest-database -- bash -c \
    "echo \"${AUTH_USERS_DUMP}\" | psql -U postgres -d auth_server" > /dev/null

echo "Enabling auth mode..."
minikube kubectl -- exec -it -n orchest deploy/orchest-api -- curl -X 'PUT' \
  'http://localhost:80/api/ctl/orchest-settings' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{"AUTH_ENABLED": true}' > /dev/null

orchest patch --cloud
orchest stop

TAG=$(orchest version --json | jq -r .version)
echo "Building images locally with tag ${TAG}..."
eval $(minikube -p minikube docker-env)
bash "${DIR}/build_container.sh" -m -t ${TAG} -o ${TAG}

orchest start
orchest status
