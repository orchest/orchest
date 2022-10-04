#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

cd "$SCRIPT_DIR/.." || exit 1

TAG="$(orchest version --latest)" 
export TAG

orchest uninstall

eval "$(minikube -p minikube docker-env)"

"$SCRIPT_DIR/build_container.sh" -M -t "$TAG" -o "$TAG"

orchest install --dev
orchest patch --dev
