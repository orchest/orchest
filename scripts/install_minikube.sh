#!/bin/bash

# This script installs a multi-node kubernetes cluster with minikube for testing purposes

set -euo pipefail

show_help() {
  cat >&2 <<-EOT
install_minikube.sh installs a multi-node kubernetes cluster with minikube for testing purposes.
Usage: ${0##*/} [<options>]
Options:
  --help, -h
    Show help.
  --nodes, -n <num_nodes>
    Number of Nodes in created Kubernetes cluster.
  --cpus, -c <num_cpus>
    Number of cpus for each node of the cluster.
  --size, -s <size>
    Size of volume to be added to each node to be used by ceph-osds in mb
---------------------------------------------------------------------------------------------------
EOT
}

# -------------------------------------------------------------------------------------------------
# Command line parsing
# -------------------------------------------------------------------------------------------------

num_nodes=3
num_cpus=3
size=15000M

while [[ $# -gt 0 ]]; do

  case ${1//_/-} in
    -h|--help)
      show_help >&2
      exit 1
    ;;
    -n|--nodes)
      num_nodes=$2
      shift
    ;;
    -c|--cpus)
      num_cpus=$2
      shift
    ;;
    -s|--size)
      size=$2
      shift
    ;;
    *)
  esac
  shift
done

log() {
  timestamp=$(date +"[%m%d %H:%M:%S]")
  echo "${timestamp} ${1-}" >&2
  shift
  for message; do
    echo "    ${message}" >&2
  done
}

# looks for $1 in the $PATH
find-binary() {
  if which "$1" >/dev/null; then
    echo -n "${1}"
  fi
}

# Checks if minikube is running and configured
minikube-status() {
  if minikube status -f={{.Host}} >/dev/null; then
    log "minikube is already running and configured, please stop and remove, then run this command again"
    exit 1
  fi
}

# Starts minikube with kvm driver
minikube-start() {
  minikube start --driver=kvm -n $1 --cpus $2 --memory 6144
  minikube addons enable ingress
}

# Stops minikube
minikube-stop() {
  minikube stop
}

create-and-attach-volumes() {
  local size=$1
  local nodes=$(eval kubectl get no -o jsonpath=\"{.items[*].metadata.name}\")
  local node
  local volume

  for node in ${nodes[@]}; do
    volume=~/.minikube/machines/${node}/minikube.qcow2
    sudo qemu-img create -f qcow2 ${volume} ${size} -o preallocation=full
    sudo virsh attach-disk --domain ${node} ${volume} --target vdb --persistent --config --live
  done
}


minikube=$(eval find-binary minikube)
if [[ -z ${minikube} ]]; then
  log "Failed to find binary ${minikube}}"
  exit 1
fi

kubectl=$(eval find-binary kubectl)
if [[ -z ${kubectl} ]]; then
  log "Failed to find binary ${kubectl}}"
  exit 1
fi


minikube-status
minikube-start ${num_nodes} ${num_cpus}
create-and-attach-volumes ${size}
minikube-stop
minikube-start ${num_nodes} ${num_cpus}


echo -n "end"
