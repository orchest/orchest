#!/bin/bash
# This is a convenience installation script  that takes care of:
# - installing minikube
# - making sure the minikube cluster is started
# - creating the 'orchest' namespace
# - creating the Orchest controller
# - installing the orchest-cli package from the repository
# - installing Orchest using the orchest-cli
# - enabling the ingress addon
# Each one of these steps is idempotent, so in the event of a random
# failure, e.g. because of networking, the script can be rerun safely.

set -e

OS="linux"

if [[ "$OSTYPE" == "darwin"* ]]; then
  echo "Detected macOS"
  OS="darwin"
fi

if ! [ -x "$(command -v pip)" ]; then
    echo "This script requires 'pip' in order to install the orchest-cli package."
    echo "Couldn't find pip, you can install it by following the recommended process:"
    echo "https://pip.pypa.io/en/stable/installation/"
    exit 1
fi

if ! [ -x "$(command -v minikube)" ]; then
    echo "Minikube is not installed. Installing minikube..."
    BIN_NAME="minikube-${OS}-amd64"
    echo "Downloading the minikube installer..."
    curl -LOs "https://storage.googleapis.com/minikube/releases/latest/${BIN_NAME}" > /dev/null
    echo "Installing minikube..."
    sudo install ${BIN_NAME}  /usr/local/bin/minikube
    rm ${BIN_NAME}
    minikube version
fi

if ! minikube status | grep "host" | grep "Running" > /dev/null ; then
    echo "Starting minikube..."
    minikube start --cpus 6 --memory 8g --disk-size 50g 
fi

if ! minikube kubectl -- get namespaces | grep "orchest " ; then
    echo "Creating 'orchest' namespace..."
    minikube kubectl -- create ns orchest
fi

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "Setting up the Orchest controller..."
minikube kubectl -- apply -f "${DIR}/../services/orchest-controller/deploy-controller" > /dev/null
minikube kubectl -- wait --timeout=15m --for=condition=available -n orchest \
    deployment/orchest-controller > /dev/null

echo "Installing the orchest-cli from this repository..."
pip install "${DIR}/../orchest-cli" > /dev/null

orchest install

if ! minikube addons list | grep "ingress " | grep "enabled" > /dev/null ; then
    echo "Enabling ingress addon..."
    minikube addons enable ingress
fi