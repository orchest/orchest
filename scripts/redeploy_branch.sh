#!/bin/bash
# Ths script will:
# - checkout the given branch
# - store the existing auth users
# - uninstall Orchest
# - detect which version will be installed, $TAG
# - build images locally with $TAG
# - install the orchest-cli from the given branch
# - install Orchest
# - restore the existing auth users
# - set cloud mode, enable auth and disable telemetry
# - restart
#
# The script is not battle proof, but an incremental movement towards
# being able to easily switch around branches to review them.  This is
# currently used for our internal preview instances. The script assumes
# Orchest to be already installed.
#
# TLDR: redeploy Orchest for a given branch, persist auth users.
# ! Heavy schema changes of the User model of the auth-server db will
# make persiting users not possible.

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

if [[ ! $# -eq 1 ]] ; then
    echo "Please specify a branch, e.g. 'bash scripts/redeploy_branch.sh dev'"
    exit 1
fi

set -e

echo "Checking out branch ${1}..."

if [ "${1}" != "dev" ] && git show-ref --quiet refs/heads/$1 ; then
    git checkout dev
    git branch -D $1    
fi

git fetch --all

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "${1}" ]]; then
  git checkout $1
fi

git pull origin $1


# Needed to get the auth users.
orchest start

echo "Storing auth users for later..."
AUTH_USERS_DUMP=$(minikube kubectl -- exec -it -n orchest deploy/orchest-database -- \
    pg_dump -U postgres --column-inserts --data-only -t users -d auth_server)

orchest uninstall

TAG=$(curl \
    https://update-info.orchest.io/api/orchest/update-info/v3\?version\=None\&is_cloud\=False \
    -s | jq -r .latest_version)
echo "Building images locally with tag ${TAG}..."
eval $(minikube -p minikube docker-env)
bash "${DIR}/build_container.sh" -m -t ${TAG} -o ${TAG}

echo "Installing the orchest-cli from this branch..."
pip install "${DIR}/../orchest-cli" > /dev/null

orchest install --dev

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

echo "Disabling telemetry..."
minikube kubectl -- exec -it -n orchest deploy/orchest-api -- curl -X 'PUT' \
  'http://localhost:80/api/ctl/orchest-settings' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{"TELEMETRY_DISABLED": true}' > /dev/null

orchest patch --cloud
# Not strictly necessary since 'patch --cloud' leads to a restart of
# the cluster, but it's a break of abstraction and might not be always
# so.
orchest restart
orchest status
