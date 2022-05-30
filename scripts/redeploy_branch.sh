#!/bin/bash
# Ths script will:
# - checkout the given branch.
# - build the minimal set of imags to run Orchest, using the current cluster version
# - drop the orchest_api and orchest_webserer databases, to avoid schema migrations
#   conflicts when switching between branches with schema migrations. This does not
#   happen for the auth_server db since you would lose all users.
# - redeploy the controller to make use of the latest changes.
# - stop and start orchest.
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


TAG=$(orchest version --json | jq -r .version)
echo "Building images locally with tag ${TAG}"
eval $(minikube -p minikube docker-env)
bash "${DIR}/build_container.sh" -m -t ${TAG} -o ${TAG}

# Needs to happen to be able to drop the DB.
orchest start

# Make the controller use the latest image and yaml changes.
kubectl scale -n orchest --replicas=0 deployment orchest-controller --timeout 10m
kubectl apply -f "${DIR}/../services/orchest-controller/deploy-controller"
kubectl scale -n orchest --replicas=1 deployment orchest-controller --timeout 10m
kubectl wait --for=condition=ready pod -n orchest -l "app=orchest-controller"

echo "Scaling down orchest-api, celery, orchest-webserver deployments to avoid DB use."
# We are actually deleting the deployment because on stop the controller
# will create it again, but with an updated configuration in case it was
# changed in that particular branch.
kubectl delete deployment -n orchest orchest-api
kubectl delete deployment -n orchest celery-worker
kubectl delete deployment -n orchest orchest-webserver
kubectl delete deployment -n orchest auth-server

set +e
echo "Dropping the orchest_api and orchest_webserver databases."
minikube kubectl -- exec -it -n orchest deploy/orchest-database -- dropdb -U postgres -f orchest_api --if-exists
minikube kubectl -- exec -it -n orchest deploy/orchest-database -- dropdb -U postgres -f orchest_webserver --if-exists
set -e


orchest patch --cloud &
# The shutdown cleanup operation will fail, that's okay.
orchest stop

orchest start

orchest status