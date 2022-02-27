NAMESPACE := ${if ${NAMESPACE},${NAMESPACE},orchest}
KUBECONFIG := ${if ${KUBECONFIG},--kubeconfig ${KUBECONFIG},}

ROOK_NAMESPACE := ${if ${ROOK_NAMESPACE},${ROOK_NAMESPACE},rook-ceph}

DEFAULT_TAG := ${if ${DEFAULT_TAG},${DEFAULT_TAG},latest}

DEBUG := ${if ${DEBUG},--debug --dry-run,}

ORCHEST_API_TAG := ${if ${ORCHEST_API_TAG},${ORCHEST_API_TAG},${DEFAULT_TAG}}
ORCHEST_LOG_LEVEL := ${if ${ORCHEST_LOG_LEVEL},${ORCHEST_LOG_LEVEL},INFO}
CLOUD := ${if ${CLOUD},${CLOUD},"False"}

# Orchest will install docker-registry by default, if it is not desired,
# define DISABLE_REGISTRY env variable and set it to something (preferably FALSE)
REGISTRY_TARGET := ${if ${DISABLE_REGISTRY},,docker-registry}

# Orchest will install rook for managing ceph by default, if it is not desired,
# define DISABLE_ROOK env variable and set it to something (preferably FALSE)
ROOK_TARGET := ${if ${DISABLE_ROOK},,rook}

# if rook is disabled, we also diable ceph-resources target
CEPH_TARGET := ${if ${DISABLE_ROOK},,ceph-resources}

SHARED_DEPLOY_CONFIG := ${KUBECONFIG} ${DEBUG} --namespace ${NAMESPACE} \
	 --create-namespace --atomic


REGISTRY_SECRET := ${if ${REGISTRY_SECRET}, ${REGISTRY_SECRET},registry-tls-secret}
REGISTRY_NAME := ${if ${REGISTRY_NAME}, ${REGISTRY_NAME},docker-registry}
REGISTRY_PORT := ${if ${REGISTRY_PORT}, ${REGISTRY_PORT},443}

# Name of default file-system and block storage classes
FILESYSTEM_STORAGE_CLASS := ${if ${CEPH_TARGET},ceph-filesystem,standard}
BLOCK_STORAGE_CLASS := ${if ${CEPH_TARGET},ceph-block,standard}

# docker-registry deployment configs
DOCKER_REGISTRY_SECRET_CONFIG := --set tlsSecretName=${REGISTRY_SECRET}
DOCKER_REGISTRY_NAME_CONFIG := --set fullnameOverride=${REGISTRY_NAME}
DOCKER_REGISTRY_PORT_CONFIG := --set service.port=${REGISTRY_PORT}

# Cluste resources enable config
CLUSTER_RSC_ENABLE_CONFIG := --set cluster-resources.enabled=true

# docker-registry resources deployment configs
ISSUER_NAME := ${if ${ISSUER_NAME},${ISSUER_NAME},certificate-issuer}
CLUSTER_RSC_REG_SECRET_CONFIG := --set cluster-resources.registry.secret=${REGISTRY_SECRET}
CLUSTER_RSC_REG_NAME_CONFIG := --set cluster-resources.registry.name=${REGISTRY_NAME}
CLUSTER_RSC_REG_ISSUER_CONFIG := --set cluster-resources.registry.issuer.name=${ISSUER_NAME}
CLUSTER_RSC_REG_ENABLE_CONFIG := --set cluster-resources.registry.enabled=true
CLUSTER_RSC_REG_DEPLOY_CONFIG := registry-resources \
								--namespace ${NAMESPACE} \
								${SHARED_DEPLOY_CONFIG}	\
								${CLUSTER_RSC_ENABLE_CONFIG} \
								${CLUSTER_RSC_REG_ENABLE_CONFIG} \
								${CLUSTER_RSC_REG_SECRET_CONFIG} \
								${CLUSTER_RSC_REG_NAME_CONFIG} \
								${CLUSTER_RSC_REG_ISSUER_CONFIG} helm

# ceph resources deployment configs
CEPH_MULTI_MON_PER_NODE := ${if ${MULTI_MON_PER_NODE},${MULTI_MON_PER_NODE},true}
CEPH_USE_ALL_DEVICES := ${if ${CEPH_USE_ALL_DEVICES},${CEPH_USE_ALL_DEVICES},false}
CEPH_RSC_ENABLE_CONFIG := --set cluster-resources.ceph.enabled=true
CEPH_MULTI_MON_PER_NODE_CONFIG := --set cluster-resources.ceph.cephClusterSpec.mon.allowMultiplePerNode=${CEPH_MULTI_MON_PER_NODE}
CEPH_USE_ALL_DEVICES_CONFIG := --set cluster-resources.ceph.cephClusterSpec.storage.useAllDevices=${CEPH_USE_ALL_DEVICES}
CEPH_FILESYSTEM_CLASS_NAME := --set cluster-resources.ceph.cephFileSystems.storageClass.name=${FILESYSTEM_STORAGE_CLASS}
CEPH_BLOCK_CLASS_NAME := --set cluster-resources.ceph.cephBlockPools.storageClass.name=${BLOCK_STORAGE_CLASS}
CLUSTER_RSC_CEPH_DEPLOY_CONFIG := ceph-resources \
								--namespace ${ROOK_NAMESPACE} \
								${SHARED_DEPLOY_CONFIG}	\
								${CLUSTER_RSC_ENABLE_CONFIG} \
								${CEPH_RSC_ENABLE_CONFIG} \
								${CEPH_USE_ALL_DEVICES_CONFIG} \
								${CEPH_MULTI_MON_PER_NODE_CONFIG} helm

# orchest resources deployment configs
ORCHEST_RSC_ENABLE_CONFIG := --set cluster-resources.orchest.enabled=true
ORCHEST_RSC_USERDIR_STORAGE := --set cluster-resources.orchest.filesystem.storageClass=${FILESYSTEM_STORAGE_CLASS}
ORCHEST_RSC_DEPLOY_CONFIG := orchest-resources \
							--namespace ${NAMESPACE} \
							${SHARED_DEPLOY_CONFIG}	\
							${CLUSTER_RSC_ENABLE_CONFIG} \
							${ORCHEST_RSC_USERDIR_STORAGE} \
							${ORCHEST_RSC_ENABLE_CONFIG} helm

# rook deplyment configs
ROOK_IMAGE_TAGE := ${if ${ROOK_IMAGE_TAGE}, ${ROOK_IMAGE_TAGE},v1.8.2}
ROOK_IMAGE_TAG_CONFIG := --set image.tag=${ROOK_IMAGE_TAGE}
ROOK_DEPLOY_CONFIG := rook \
	${SHARED_DEPLOY_CONFIG} ${ROOK_IMAGE_TAG_CONFIG} --namespace ${ROOK_NAMESPACE} thirdparty/rook/rook-ceph

# orchest Api deployment configs
ORCHEST_API_ENABLE_CONFIG := --set orchest-api.enabled=true

# auth-server deployment configs
AUTH_SERVER_ENABLE_CONFIG := --set auth-server.enabled=true

# celery-worker deployment configs
CELERY_WORKER_ENABLE_CONFIG := --set celery-worker.enabled=true

# file-manager deployment configs
FILE_MANAGER_ENABLE_CONFIG := --set file-manager.enabled=true

# orchest-webserver deployment configs
ORCHEST_WEBSERVER_ENABLE_CONFIG := --set orchest-webserver.enabled=true

# postgres deployment configs
POSTGRES_ENABLE_CONFIG := --set postgres.enabled=true

# rabbitmq deployment configs
RABBITMQ_ENABLE_CONFIG := --set rabbitmq.enabled=true

# update-sidecar service configs
UPDATE_SIDECAR_ENABLE_CONFIG := --set update-sidecar.enabled=true

# node-agent deployment configs
NODE_AGENT_ENABLE_CONFIG := --set node-agent.enabled=true

# Orchest deployment configs
ORCHEST_ENABLE_CONFIG := ${ORCHEST_API_ENABLE_CONFIG} \
						 ${AUTH_SERVER_ENABLE_CONFIG} \
						 ${CELERY_WORKER_ENABLE_CONFIG} \
						 ${FILE_MANAGER_ENABLE_CONFIG} \
						 ${ORCHEST_WEBSERVER_ENABLE_CONFIG} \
						 ${POSTGRES_ENABLE_CONFIG} \
						 ${RABBITMQ_ENABLE_CONFIG} \
						 ${NODE_AGENT_ENABLE_CONFIG} \
						 ${UPDATE_SIDECAR_ENABLE_CONFIG}

ORCHEST_DEPLOY_CONFIG := orchest \
	${SHARED_DEPLOY_CONFIG} \
	${ORCHEST_ENABLE_CONFIG} \
	--namespace ${NAMESPACE} \
	--set-string auth-server.CLOUD="${CLOUD}" \
	--set-string orchest-webserver.CLOUD="${CLOUD}" \
	--set-string auth-server.ORCHEST_LOG_LEVEL="${ORCHEST_LOG_LEVEL}" \
	--set-string celery-worker.ORCHEST_LOG_LEVEL="${ORCHEST_LOG_LEVEL}" \
	--set-string orchest-api.ORCHEST_LOG_LEVEL="${ORCHEST_LOG_LEVEL}" \
	--set-string orchest-webserver.ORCHEST_LOG_LEVEL="${ORCHEST_LOG_LEVEL}" \
	helm

JUPYTER_EG_DEPLOY_CONFIG := jupyter-eg \
	${SHARED_DEPLOY_CONFIG} --namespace ${NAMESPACE} thirdparty/enterprise-gateway

ARGO_WORKFLOW_DEPLOY_CONFIG := argo-workflow \
	${SHARED_DEPLOY_CONFIG} --namespace ${NAMESPACE} thirdparty/argo-workflows

# Docker-registry deployment configs
DOCKER_REGISTRY_DEPLOY_CONFIG := registry \
	--namespace ${NAMESPACE} \
	${SHARED_DEPLOY_CONFIG} ${DOCKER_REGISTRY_SECRET_CONFIG} ${DOCKER_REGISTRY_NAME_CONFIG} \
	${DOCKER_REGISTRY_PORT_CONFIG} thirdparty/docker-registry

.PHONY: orchest
orchest: initialize | orchest-resources
	helm install ${ORCHEST_DEPLOY_CONFIG}

# usefull for debugging, not recommended to use without DEBUG=true enabled
.PHONY: node-agent
node-agent:
	helm install node-agent \
	--namespace ${NAMESPACE} \
	${SHARED_DEPLOY_CONFIG} \
	${NODE_AGENT_ENABLE_CONFIG} helm


.PHONY: jupyter-eg
jupyter-eg: ./bin/jupyter-eg

.SECONDARY: ./bin/jupyter-eg
./bin/jupyter-eg: create-bin
	helm install ${JUPYTER_EG_DEPLOY_CONFIG}
	touch $@

.PHONY: argo-workflow
argo-workflow: ./bin/argo-workflow

.SECONDARY: ./bin/argo-workflow
./bin/argo-workflow: create-bin
	helm install ${ARGO_WORKFLOW_DEPLOY_CONFIG}
	touch $@

.PHONY: docker-registry
docker-registry : ./bin/docker-registry

.SECONDARY: ./bin/docker-registry
./bin/docker-registry: | create-bin registry-resources
	helm install ${DOCKER_REGISTRY_DEPLOY_CONFIG}
	touch $@

.PHONY: cert-manager
cert-manager : ./bin/cert-manager

.SECONDARY: ./bin/cert-manager
./bin/cert-manager: | create-bin
	kubectl apply -f thirdparty/cert-manager
	# TODO, This is a hack, evaluate using wait
	# sleep 30
	touch $@

.PHONY: rook
rook: ./bin/rook

.SECONDARY: ./bin/rook
./bin/rook: | create-bin
	helm install ${ROOK_DEPLOY_CONFIG}
	touch $@

.PHONY: registry-resources
registry-resources: ./bin/registry-resources

.SECONDARY: ./bin/registry-resources
./bin/registry-resources: | create-bin cert-manager ${CEPH_TARGET}
	helm install ${CLUSTER_RSC_REG_DEPLOY_CONFIG}
	touch $@

.PHONY: ceph-resources
ceph-resources: ./bin/ceph-resources

.SECONDARY: ./bin/ceph-resources
./bin/ceph-resources: | create-bin ${ROOK_TARGET}
	helm install ${CLUSTER_RSC_CEPH_DEPLOY_CONFIG}
	touch $@

.PHONY: orchest-resources
orchest-resources: ./bin/orchest-resources

.SECONDARY: ./bin/orchest-resources
./bin/orchest-resources: | create-bin
	helm install ${ORCHEST_RSC_DEPLOY_CONFIG}
	touch $@

.PHONY: create-bin
create-bin:
	@mkdir -p ./bin

.PHONY: initialize
initialize: ./bin/initialize

.SECONDARY: ./bin/initialize
./bin/initialize: create-bin | argo-workflow ${REGISTRY_TARGET} ${CEPH_TARGET} orchest-resources
	touch $@


.PHONY: orchest-upgrade
orchest-upgrade:
	helm upgrade ${ORCHEST_DEPLOY_CONFIG}

.PHONY: argo-upgrade
argo-upgrade:
	helm upgrade ${ARGO_WORKFLOW_DEPLOY_CONFIG}

.PHONY: registry-upgrade
registry-upgrade:
	helm upgrade ${DOCKER_REGISTRY_DEPLOY_CONFIG}
