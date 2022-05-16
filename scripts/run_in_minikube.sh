#!/bin/bash
# Runs a command on every minikube node, in parallel. This is useful,
# for example, to make sure a given image has been built on every node.
# Example usage:
# Build an image on all nodes, so that the next launched pod will use
# said image:
# bash scripts/run_in_minikube.sh /orchest-dev-repo/scripts/build_container.sh \
# i orchest-api -o v2022.03.7 -t v2022.03.7
# Delete an image from all nodes, so that the image will be pulled from
# the registry on the next pod creation:
# bash scripts/run_in_minikube.sh docker rmi orchest/orchest-api:v2022.03.7


nodes=$(eval kubectl get no -o jsonpath=\"{.items[*].metadata.name}\")
for node in ${nodes[@]}; do
    minikube ssh -n $node -- "$@" &
done
wait
