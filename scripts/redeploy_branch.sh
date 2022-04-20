#!/bin/bash
# Ths script will:
# - checkout the given branch
# - build the minimal set of imags to run Orchest, using the current cluster version
# - drop the orchest_api and orchest_webserer databases, to avoid schema migrations
#   conflicts when switching between branches with schema migrations. This does not
#   happen for the auth_server db since you would lose all users.
# - stop orchest
# - perform "./orchest hidden-update" to deploy both yaml and code changes
#
# The script is not battle proof, more like an incremental movement towards being able
# to easily switch around branches to review them.

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

if [[ ! $# -eq 1 ]] ; then
    echo "Please specify a branch, e.g. 'bash scripts/redeploy_branch.sh dev'"
    exit 1
fi

set -e

echo "Checking out branch ${1}."
git fetch --all
git checkout $1
git pull origin $1


TAG=$($DIR/../orchest version --json | jq -r .cluster_version)
echo "Building images locally with tag ${TAG}"
eval $(minikube -p minikube docker-env)
bash "${DIR}/build_container.sh" -m -t ${TAG} -o ${TAG}

echo "Scaling down orchest-api and orchest-webserver deployments to avoid DB usage."
kubectl scale -n orchest --replicas=0 deployment orchest-api --timeout 10m
kubectl scale -n orchest --replicas=0 deployment orchest-webserver --timeout 10m

set +e
echo "Dropping the orchest_api and orchest_webserver databases, might take a while."
minikube kubectl -- exec -it -n orchest deploy/orchest-database -- dropdb -U postgres -f orchest_api --if-exists
minikube kubectl -- exec -it -n orchest deploy/orchest-database -- dropdb -U postgres -f orchest_webserver --if-exists
set -e


echo "!The shutdown cleanup operation will fail, that's okay."
bash "${DIR}/../orchest" stop


# This will apply yaml changes from the branch
bash "${DIR}/../orchest" hidden-update