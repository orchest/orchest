#!/bin/bash
show_help() {
  cat >&2 <<-EOT
Usage: ${0##*/} <image to remove from minikube>
Removes an image from all minikube nodes. Useful, for example, to
cleanup a given orchest service image and make it so that the next pod
will pull said image from the registry. Example usage:
${0##*/} orchest-api # To remove all orchest-api images (all tags).
${0##*/} orchest-api:mytag # To remove a specific image (tag).
EOT
}

if [[ " $@ " =~ " --help " ]]; then
	show_help
	exit 0
fi

nodes=$(eval kubectl get no -o jsonpath=\"{.items[*].metadata.name}\")
for node in ${nodes[@]}; do
    minikube ssh -n $node -- "name=$1" '
		imgs=$(docker image list $name -q)
		for img in ${imgs[@]}; do
			docker rmi $img
		done
	'&
done
wait
echo "done"