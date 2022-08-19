to_build=(
	auth-server
	base-kernel-julia
	base-kernel-javascript
	base-kernel-py
	base-kernel-r
	celery-worker
	jupyter-enterprise-gateway
	jupyter-server
	node-agent
	orchest-api
	orchest-webserver
	session-sidecar
)
tag="k8s-beta"

for i in "${to_build[@]}"
do
	bash build_container.sh -i ${i} -o "${tag}" -t "${tag}"
	docker push "orchest/${i}:${tag}" &
done
