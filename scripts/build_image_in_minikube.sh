#!/bin/bash
show_help() {
  cat >&2 <<-EOT
Essentially a wrapper around the build_container.sh script to build
an image on all minikube nodes, so that a pod will use that regardless
on which node it lands on. Requires the orchest repository to be mounted
in all nodes at /orchest-dev-repo.
Usage: ${0##*/} <name of orchest service> <desired tag>
${0##*/} orchest-api v2022.03.8. 
EOT
}

if [[ " $@ " =~ " --help " ]]; then
    show_help
    exit 0
fi
if [[ ! $# -eq 2 ]] ; then
    show_help
    exit 0
fi

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
"${DIR}/run_in_minikube.sh" /orchest-dev-repo/scripts/build_container.sh \
    -i $1 -t $2 -o $2