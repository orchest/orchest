set -e
IMGS=(
	"base-kernel-py"
	"buildkit-daemon"
	"celery-worker"
	"image-builder-buildkit"
	"image-builder-buildx"
	"image-puller"
	"jupyter-enterprise-gateway"
	"jupyter-server"
	"node-agent"
	"orchest-api"
	"orchest-controller"
	"orchest-webserver"
)

if [ "${1}" != "skip-docker" ]; then
	VERSION="v2022.09.1"
	for IMG in ${IMGS[@]}
	do
			echo "saving ${IMG}:${VERSION}"
		docker save --output "/tmp/${IMG}.tar" "orchest/${IMG}:${VERSION}" &
	done
	wait < <(jobs -p)
fi

for IMG in ${IMGS[@]}
do
    echo "loading ${IMG}"
	microk8s ctr image import - < "/tmp/${IMG}.tar" &
done

wait < <(jobs -p)