#!/bin/bash
# This is a convenience installation script  that takes care of:
# - installing minikube
# - making sure the minikube cluster is started
# - installing the orchest-cli through pip
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
    MACHINE_NAME=$(uname -m)
    if [[ "$MACHINE_NAME" == "x86_64" ]]; then
        echo "Detected amd64"
        MACHINE_NAME="amd64"
    fi
    BIN_NAME="minikube-${OS}-${MACHINE_NAME}"

    echo "Downloading the minikube installer..."
    curl -LOs "https://storage.googleapis.com/minikube/releases/latest/${BIN_NAME}" > /dev/null
    echo "Installing minikube..."
    sudo install ${BIN_NAME}  /usr/local/bin/minikube
    rm ${BIN_NAME}
    minikube version
fi

if ! minikube status | grep "host" | grep "Running" > /dev/null ; then
    echo "Starting minikube..."
    minikube start --cpus max --memory max --disk-size 50g
fi

if ! minikube addons list | grep "ingress " | grep "enabled" > /dev/null ; then
    echo "Enabling ingress addon..."
    minikube addons enable ingress
fi

pip install orchest-cli --upgrade

if [ -x "$(command -v orchest)" ]; then
    orchest install
else
    # NOTE: Formatting in the last `echo` is needed to make sure that
    # users can actually run the outputted command.
    echo "ERROR: It seems like 'pip' installed 'orchest' outside of your PATH"
    echo "Try opening a new terminal after running:"
    echo "\techo \"export PATH=\\\"\\\$PATH:\\\$HOME/.local/bin\\\"\" >> ~/.profile"
fi
