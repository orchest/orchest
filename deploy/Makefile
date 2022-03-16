NAMESPACE := ${if ${NAMESPACE},${NAMESPACE},orchest}
KUBECONFIG := ${if ${KUBECONFIG},--kubeconfig ${KUBECONFIG},}

ROOK_CEPH_NAMESPACE := ${if ${ROOK_CEPH_NAMESPACE},${ROOK_CEPH_NAMESPACE},rook-ceph}

ROOK_NFS_NAMESPACE := ${if ${ROOK_NFS_NAMESPACE},${ROOK_NFS_NAMESPACE},rook-nfs}

ORCHEST_DEFAULT_TAG := ${if ${ORCHEST_DEFAULT_TAG},${ORCHEST_DEFAULT_TAG},latest}

# If DEPEND_RESOURCES is set to FALSE, the orchest target is not dependent 
# to orchest-resources target, thus orchest-resources must have been deployed already
ifeq (${DEPEND_RESOURCES},FALSE)
  ORCHEST_RESOURCES_TARGET := 
else
  ORCHEST_RESOURCES_TARGET := orchest-resources
endif

DEBUG := ${if ${DEBUG},--debug --dry-run,}

ORCHEST_LOG_LEVEL := ${if ${ORCHEST_LOG_LEVEL},${ORCHEST_LOG_LEVEL},INFO}
CLOUD := ${if ${CLOUD},${CLOUD},"False"}

# Orchest will install docker-registry by default, if it is not desired,
# define DISABLE_REGISTRY env variable and set it to something (preferably FALSE)
REGISTRY_TARGET := ${if ${DISABLE_REGISTRY},,docker-registry}

# Orchest will install rook/rook (rook-ceph) for managing ceph by, if it is desired,
# define ENABLE_ROOK_CEPH env variable and set it to something (preferably TRUE)
ROOK_CEPH_TARGET := ${if ${ENABLE_ROOK_CEPH},rook-ceph,}

# if rook-ceph is enable, we also enable ceph-resources target
CEPH_RESOURCES_TARGET := ${if ${ENABLE_ROOK_CEPH},ceph-resources,}

# Orchest will install rook/nfs for managing on promise nfs server, if it is desired,
# define ENABLE_ROOK_NFS env variable and set it to something (preferably TRUE)
ROOK_NFS_TARGET := ${if ${ENABLE_ROOK_NFS},rook-nfs,}

# if rook-nfs is enable, we also enable nfs-resources target
NFS_RESOURCES_TARGET := ${if ${ROOK_NFS_TARGET},nfs-resources,}

ORCHEST_PVC_BACKEND_TARGET := ${if ${NFS_RESOURCES_TARGET},${NFS_RESOURCES_TARGET},${CEPH_RESOURCES_TARGET}}

SHARED_DEPLOY_CONFIG := ${KUBECONFIG} ${DEBUG} --create-namespace --atomic --timeout 600s

REGISTRY_SECRET := ${if ${REGISTRY_SECRET}, ${REGISTRY_SECRET},registry-tls-secret}
REGISTRY_NAME := ${if ${REGISTRY_NAME}, ${REGISTRY_NAME},docker-registry}
REGISTRY_PORT := ${if ${REGISTRY_PORT}, ${REGISTRY_PORT},443}

# Name of default file-system and block storage classes
FILESYSTEM_STORAGE_CLASS := standard
BLOCK_STORAGE_CLASS := standard

ifeq (${ROOK_CEPH_TARGET},rook-ceph)
  FILESYSTEM_STORAGE_CLASS := ceph-filesystem
  BLOCK_STORAGE_CLASS := ceph-block
else ifeq (${ROOK_NFS_TARGET},rook-nfs)
  FILESYSTEM_STORAGE_CLASS := rook-nfs-storage-class
endif

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
								--namespace ${ROOK_CEPH_NAMESPACE} \
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

# rook-ceph deplyment configs
ROOK_CEPH_IMAGE_TAGE := ${if ${ROOK_CEPH_IMAGE_TAGE}, ${ROOK_CEPH_IMAGE_TAGE},v1.8.2}
ROOK_CEPH_IMAGE_TAG_CONFIG := --set image.tag=${ROOK_IMAGE_TAGE}
ROOK_CEPH_DEPLOY_CONFIG := rook-ceph \
	${SHARED_DEPLOY_CONFIG} ${ROOK_CEPH_IMAGE_TAG_CONFIG} --namespace ${ROOK_CEPH_NAMESPACE} thirdparty/rook/rook-ceph

# rook-nfs deplyment configs
ROOK_NFS_IMAGE_TAGE := ${if ${ROOK_NFS_IMAGE_TAGE}, ${ROOK_NFS_IMAGE_TAGE},v1.7.3}
ROOK_NFS_IMAGE_TAG_CONFIG := --set image.tag=${ROOK_NFS_IMAGE_TAGE}
ROOK_NFS_DEPLOY_CONFIG := rook-nfs \
						  --namespace ${ROOK_NFS_NAMESPACE} \
						  ${SHARED_DEPLOY_CONFIG} \
						  ${ROOK_NFS_IMAGE_TAG_CONFIG} thirdparty/rook/rook-nfs

# nfs resources deplyment configs
NFS_RSC_ENABLE_CONFIG := --set cluster-resources.nfs.enabled=true
NFS_RSC_STORAGE_CLASS_NAME := --set cluster-resources.nfs.nfs.storageClass.name=${FILESYSTEM_STORAGE_CLASS}
NFS_RSC_DEPLOY_CONFIG := nfs-resources \
						--namespace ${ROOK_NFS_NAMESPACE} \
						${SHARED_DEPLOY_CONFIG}	\
						${NFS_RSC_STORAGE_CLASS_NAME} \
						${CLUSTER_RSC_ENABLE_CONFIG} \
						${NFS_RSC_ENABLE_CONFIG} helm

# orchest Api deployment configs
ORCHEST_API_TAG := ${if ${ORCHEST_API_TAG},${ORCHEST_API_TAG},${ORCHEST_DEFAULT_TAG}}
ORCHEST_API_TAG_CONFIG := --set orchest-api.images.tag=${ORCHEST_API_TAG}
ORCHEST_API_ENABLE_CONFIG := --set orchest-api.enabled=true
ORCHEST_API_CONFIG := ${ORCHEST_API_TAG_CONFIG} \
					  ${ORCHEST_API_ENABLE_CONFIG}

# auth-server deployment configs
AUTH_SERVER_TAG := ${if ${AUTH_SERVER_TAG},${AUTH_SERVER_TAG},${ORCHEST_DEFAULT_TAG}}
AUTH_SERVER_TAG_CONFIG := --set auth-server.images.tag=${AUTH_SERVER_TAG}
AUTH_SERVER_ENABLE_CONFIG := --set auth-server.enabled=true
AUTH_SERVER_CONFIG := ${AUTH_SERVER_TAG_CONFIG} \
					  ${AUTH_SERVER_ENABLE_CONFIG}

# celery-worker deployment configs
CELERY_WORKER_TAG := ${if ${CELERY_WORKER_TAG},${CELERY_WORKER_TAG},${ORCHEST_DEFAULT_TAG}}
CELERY_WORKER_TAG_CONFIG := --set celery-worker.images.tag=${CELERY_WORKER_TAG}
CELERY_WORKER_ENABLE_CONFIG := --set celery-worker.enabled=true
CELERY_WORKER_CONFIG := ${CELERY_WORKER_TAG_CONFIG} \
						${CELERY_WORKER_ENABLE_CONFIG}

# file-manager deployment configs
FILE_MANAGER_TAG := ${if ${FILE_MANAGER_TAG},${FILE_MANAGER_TAG},${ORCHEST_DEFAULT_TAG}}
FILE_MANAGER_TAG_CONFIG := --set file-manager.images.tag=${FILE_MANAGER_TAG}
FILE_MANAGER_ENABLE_CONFIG := --set file-manager.enabled=true
FILE_MANAGER_CONFIG := ${FILE_MANAGER_TAG_CONFIG} \
					   ${FILE_MANAGER_ENABLE_CONFIG}

# orchest-webserver deployment configs
ORCHEST_WEBSERVER_TAG := ${if ${ORCHEST_WEBSERVER_TAG},${ORCHEST_WEBSERVER_TAG},${ORCHEST_DEFAULT_TAG}}
ORCHEST_WEBSERVER_TAG_CONFIG := --set orchest-webserver.images.tag=${ORCHEST_WEBSERVER_TAG}
ORCHEST_WEBSERVER_ENABLE_CONFIG := --set orchest-webserver.enabled=true
ORCHEST_WEBSERVER_CONFIG := ${ORCHEST_WEBSERVER_TAG_CONFIG} \
							${ORCHEST_WEBSERVER_ENABLE_CONFIG}

# update-sidecar service configs
UPDATE_SIDECAR_ENABLE_CONFIG := --set update-sidecar.enabled=true
UPDATE_SIDECAR_CONFIG := ${UPDATE_SIDECAR_ENABLE_CONFIG}

# node-agent deployment configs
NODE_AGENT_TAG := ${if ${NODE_AGENT_TAG},${NODE_AGENT_TAG},${ORCHEST_DEFAULT_TAG}}
NODE_AGENT_TAG_CONFIG := --set node-agent.images.tag=${NODE_AGENT_TAG}
NODE_AGENT_ENABLE_CONFIG := --set node-agent.enabled=true
NODE_AGENT_CONFIG := ${NODE_AGENT_TAG_CONFIG} \
					 ${NODE_AGENT_ENABLE_CONFIG}

# postgres deployment configs
POSTGRES_TAG_CONFIG := ${if ${POSTGRES_TAG},--set postgres.images.tag=${POSTGRES_TAG},}
POSTGRES_ENABLE_CONFIG := --set postgres.enabled=true
POSTGRES_CONFIG := ${POSTGRES_TAG_CONFIG} \
				   ${POSTGRES_ENABLE_CONFIG}

# rabbitmq deployment configs
RABBITMQ_TAG_CONFIG := ${if ${RABBITMQ_TAG},--set rabbitmq.images.tag=${RABBITMQ_TAG},}
RABBITMQ_ENABLE_CONFIG := --set rabbitmq.enabled=true
RABBITMQ_CONFIG := ${RABBITMQ_TAG_CONFIG} \
				   ${RABBITMQ_ENABLE_CONFIG}
						 

ORCHEST_DEPLOY_CONFIG := orchest \
	${SHARED_DEPLOY_CONFIG} \
	${ORCHEST_API_CONFIG} \
	${AUTH_SERVER_CONFIG} \
	${CELERY_WORKER_CONFIG} \
	${FILE_MANAGER_CONFIG} \
	${UPDATE_SIDECAR_CONFIG} \
	${ORCHEST_WEBSERVER_CONFIG} \
	${NODE_AGENT_CONFIG} \
	${POSTGRES_CONFIG} \
	${RABBITMQ_CONFIG} \
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
orchest: initialize | ${ORCHEST_RESOURCES_TARGET}
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
./bin/argo-workflow: | create-bin
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

.PHONY: rook-ceph
rook-ceph: ./bin/rook-ceph

.SECONDARY: ./bin/rook-ceph
./bin/rook-ceph: | create-bin
	helm install ${ROOK_CEPH_DEPLOY_CONFIG}
	touch $@


.PHONY: rook-nfs
rook-nfs: ./bin/rook-nfs

.SECONDARY: ./bin/rook-nfs
./bin/rook-nfs: | create-bin
	helm install ${ROOK_NFS_DEPLOY_CONFIG}
	touch $@

.PHONY: registry-resources
registry-resources: ./bin/registry-resources

.SECONDARY: ./bin/registry-resources
./bin/registry-resources: | create-bin cert-manager ${CEPH_RESOURCES_TARGET}
	helm install ${CLUSTER_RSC_REG_DEPLOY_CONFIG}
	touch $@

.PHONY: ceph-resources
ceph-resources: ./bin/ceph-resources

.SECONDARY: ./bin/ceph-resources
./bin/ceph-resources: | create-bin ${ROOK_CEPH_TARGET}
	helm install ${CLUSTER_RSC_CEPH_DEPLOY_CONFIG}
	touch $@

.PHONY: nfs-resources
nfs-resources: ./bin/nfs-resources

.SECONDARY: ./bin/nfs-resources
./bin/nfs-resources: | create-bin rook-nfs
	helm install ${NFS_RSC_DEPLOY_CONFIG}
	touch $@	

.PHONY: orchest-resources
orchest-resources: ./bin/orchest-resources

.SECONDARY: ./bin/orchest-resources
./bin/orchest-resources: | create-bin ${ORCHEST_PVC_BACKEND_TARGET}
	helm install ${ORCHEST_RSC_DEPLOY_CONFIG}
	touch $@

.PHONY: create-bin
create-bin:
	@mkdir -p ./bin

.PHONY: initialize
initialize: ./bin/initialize

.SECONDARY: ./bin/initialize
./bin/initialize: create-bin | argo-workflow ${REGISTRY_TARGET} ${ORCHEST_RESOURCES_TARGET}
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
