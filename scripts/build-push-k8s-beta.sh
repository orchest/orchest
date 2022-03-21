to_build=(
	auth-server
	base-kernel-julia
	base-kernel-py
	base-kernel-py-gpu
	base-kernel-r
	celery-worker
	jupyter-enterprise-gateway
	jupyter-server
	node-agent
	orchest-api
	memory-server
	orchest-ctl
	orchest-webserver
	session-sidecar
	update-sidecar
)
tag="k8s-beta"

for i in "${to_build[@]}"
do
	bash build_container.sh -i ${i} -o "${tag}" -t "${tag}"
	docker push "orchest/${i}:${tag}" &
done
