#!/bin/bash
show_help() {
  cat >&2 <<-EOT
This script will build the image of the given service across all
minikube nodes, then kill all the pods related to that orchest service
so that new pods using the newly built image will be created. Requires
the orchest repository to be mounted in all nodes at
/orchest-dev-repo.
Usage: ${0##*/} <name of orchest service>
${0##*/} orchest-api
EOT
}

if [[ " $@ " =~ " --help " ]]; then
    show_help
    exit 0
fi
if [[ ! $# -eq 1 ]] ; then
    show_help
    exit 0
fi

tag=$(kubectl get namespace orchest -o jsonpath={.metadata.labels.version})

echo "Building ${1}:${tag}."
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
"${DIR}/build_image_in_minikube.sh" $1 $tag > /dev/null

target_label="app.kubernetes.io/name=$1"

echo "Killing all pods belonging to ${1}, through label ${target_label}."
del_output=$(kubectl delete pods -n orchest -l "${target_label}")

if [[ $del_output == "No resources found" ]]; then
    exit
fi
echo $del_output

echo "Waiting for pods to become ready..."
while ! kubectl wait --for=condition=ready pod -n orchest -l ${target_label} 2> /dev/null
do
    sleep 1
done

