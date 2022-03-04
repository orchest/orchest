NAMESPACE := ${if ${NAMESPACE},${NAMESPACE},orchest}
KUBECONFIG := ${if ${KUBECONFIG},--kubeconfig ${KUBECONFIG},}

DEFAULT_TAG := ${if ${DEFAULT_TAG},${DEFAULT_TAG},latest}

DEBUG := ${if ${DEBUG},--debug --dry-run,}

ORCHEST_API_TAG := ${if ${ORCHEST_API_TAG},${ORCHEST_API_TAG},${DEFAULT_TAG}}

# Orchest will install docker-registry by default, if it is not desired, 
# define DISABLE_REGISTRY env variable and set it to something (preferably FALSE)
REGISTRY_TARGET := ${if ${DISABLE_REGISTRY},,./bin/docker-registry}

# Orchest will install rook for managing ceph by default, if it is not desired, 
# define DISABLE_ROOK env variable and set it to something (preferably FALSE)
ROOK_TARGET := ${if ${DISABLE_ROOK},,./bin/rook}

SHARED_DEPLOY_CONFIG := ${KUBECONFIG} ${DEBUG} --namespace ${NAMESPACE} \
	 --create-namespace --wait --atomic


REGISTRY_SECRET := ${if ${REGISTRY_SECRET}, ${REGISTRY_SECRET},registry-tls-secret}
REGISTRY_NAME := ${if ${REGISTRY_NAME}, ${REGISTRY_NAME},docker-registry}
REGISTRY_PORT := ${if ${REGISTRY_PORT}, ${REGISTRY_PORT},443}

# docker-registry deployment configs
DOCKER_REGISTRY_SECRET_CONFIG := --set tlsSecretName=${REGISTRY_SECRET}
DOCKER_REGISTRY_NAME_CONFIG := --set fullnameOverride=${REGISTRY_NAME}
DOCKER_REGISTRY_PORT_CONFIG := --set service.port=${REGISTRY_PORT}


# Orchest cluster resource deployment configs
ISSUER_NAME := ${if ${ISSUER_NAME},${ISSUER_NAME},certificate-issuer}
CLUSTER_RSC_REG_SECRET_CONFIG := --set cluster-resources.registry.secret=${REGISTRY_SECRET}
CLUSTER_RSC_REG_NAME_CONFIG := --set cluster-resources.registry.name=${REGISTRY_NAME}
CLUSTER_RSC_ISSUER_CONFIG := --set cluster-resources.issuer.name=${ISSUER_NAME}
CLUSTER_RSC_ENABLE_CONFIG := --set cluster-resources.enabled=true
CLUSTER_RSC_DEPLOY_CONFIG := cluster-resources \
	${SHARED_DEPLOY_CONFIG}	${CLUSTER_RSC_REG_SECRET_CONFIG} ${CLUSTER_RSC_REG_NAME_CONFIG} \
	${CLUSTER_RSC_ISSUER_CONFIG} ${CLUSTER_RSC_ENABLE_CONFIG} helm

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

# Orchest deployment configs
ORCHEST_ENABLE_CONFIG := ${ORCHEST_API_ENABLE_CONFIG} \
						 ${AUTH_SERVER_ENABLE_CONFIG} \
						 ${CELERY_WORKER_ENABLE_CONFIG} \
						 ${FILE_MANAGER_ENABLE_CONFIG} \
						 ${ORCHEST_WEBSERVER_ENABLE_CONFIG} \
						 ${POSTGRES_ENABLE_CONFIG} \
						 ${RABBITMQ_ENABLE_CONFIG} \
						 ${UPDATE_SERVER_ENABLE_CONFIG}

ORCHEST_DEPLOY_CONFIG := orchest \
	${SHARED_DEPLOY_CONFIG} ${ORCHEST_ENABLE_CONFIG} helm 

ROOK_DEPLOY_CONFIG := rook \
	${SHARED_DEPLOY_CONFIG} thirdparty/rook/rook-ceph -f values-override.yaml .

JUPYTER_EG_DEPLOY_CONFIG := jupyter-eg \
	${SHARED_DEPLOY_CONFIG} thirdparty/enterprise-gateway

ARGO_WORKFLOW_DEPLOY_CONFIG := argo-workflow \
	${SHARED_DEPLOY_CONFIG} thirdparty/argo-workflows

# Docker-registry deployment configs
DOCKER_REGISTRY_DEPLOY_CONFIG := registry \
	${SHARED_DEPLOY_CONFIG} ${DOCKER_REGISTRY_SECRET_CONFIG} ${DOCKER_REGISTRY_NAME_CONFIG} \
	${DOCKER_REGISTRY_PORT_CONFIG} thirdparty/docker-registry	

.PHONY: orchest
orchest: initialize
	helm install ${ORCHEST_DEPLOY_CONFIG}

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
./bin/docker-registry: | create-bin cluster-resources
	helm install ${DOCKER_REGISTRY_DEPLOY_CONFIG}
	touch $@

.PHONY: cert-manager
cert-manager : ./bin/cert-manager

.SECONDARY: ./bin/cert-manager
./bin/cert-manager: | create-bin
	kubectl apply -f thirdparty/cert-manager
	# TODO, This is a hack, evaluate using wait
	sleep 30
	touch $@

.PHONY: cluster-resources
cluster-resources: ./bin/cluster-resources
	
.SECONDARY: ./bin/cluster-resources
./bin/cluster-resources: | create-bin cert-manager
	helm install ${CLUSTER_RSC_DEPLOY_CONFIG}
	touch $@

.PHONY: create-bin
create-bin:
	@mkdir -p ./bin

.PHONY: initialize
initialize: ./bin/initialize

.SECONDARY: ./bin/initialize
./bin/initialize: create-bin | ./bin/argo-workflow ${REGISTRY_TARGET} ${ROOK_TARGET} 
	touch $@

.PHONY: rook
rook:
	helm install ${ROOK_DEPLOY_CONFIG}

.PHONY: orchest-upgrade
orchest-upgrade:
	helm upgrade ${ORCHEST_DEPLOY_CONFIG} 

.PHONY: argo-upgrade
argo-upgrade:
	helm upgrade ${ARGO_WORKFLOW_DEPLOY_CONFIG} 

.PHONY: registry-upgrade
registry-upgrade:
	helm upgrade ${DOCKER_REGISTRY_DEPLOY_CONFIG} 