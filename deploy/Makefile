NAMESPACE := ${if ${NAMESPACE},${NAMESPACE},orchest}
KUBECONFIG := ${if ${KUBECONFIG},${KUBECONFIG},~/.kube/config}

DEFAULT_TAG := ${if ${DEFAULT_TAG},${DEFAULT_TAG},latest}

DEBUG := ${if ${DEBUG},--debug --dry-run,}

ORCHEST_API_TAG := ${if ${ORCHEST_API_TAG},${ORCHEST_API_TAG},${DEFAULT_TAG}}

# Orchest will install docker-registry by default, if it is not desired, 
# define DISABLE_REGISTRY env variable and set it to something (preferably FALSE)
REGISTRY_TARGET := ${if ${DISABLE_REGISTRY},,./bin/docker-registry}

# Orchest will install rook for managing ceph by default, if it is not desired, 
# define DISABLE_ROOK env variable and set it to something (preferably FALSE)
ROOK_TARGET := ${if ${DISABLE_ROOK},,./bin/rook}

SHARED_DEPLOY_CONFIG := --kubeconfig ${KUBECONFIG} \
	${DEBUG} --namespace ${NAMESPACE} --create-namespace

ORCHEST_DEPLOY_CONFIG := orchest \
	${SHARED_DEPLOY_CONFIG} helm

ROOK_DEPLOY_CONFIG := rook \
	${SHARED_DEPLOY_CONFIG} thirdparty/rook/rook-ceph -f values-override.yaml .

JUPYTER_EG_DEPLOY_CONFIG := jupyter-eg \
	${SHARED_DEPLOY_CONFIG} thirdparty/enterprise-gateway

ARGO_WORKFLOW_DEPLOY_CONFIG := argo-workflow \
	${SHARED_DEPLOY_CONFIG} thirdparty/argo-workflows

DOCKER_REGISTRY_DEPLOY_CONFIG := registry \
	${SHARED_DEPLOY_CONFIG} thirdparty/docker-registry

.PHONY: orchest
orchest: initialize
	helm install ${ORCHEST_DEPLOY_CONFIG}

.PHONY: jupyter-eg
jupyter-eg: ./bin/jupyter-eg
	
.SECONDARY: jupyter-eg
./bin/jupyter-eg:
	helm install ${JUPYTER_EG_DEPLOY_CONFIG}
	touch $@

.PHONY: argo-workflow
argo-workflow: ./bin/argo-workflow

.SECONDARY: argo-workflow
./bin/argo-workflow:
	helm install ${ARGO_WORKFLOW_DEPLOY_CONFIG}
	touch $@

.PHONY: docker-registry
docker-registry : ./bin/docker-registry

.SECONDARY: ./bin/docker-registry
./bin/docker-registry: ${ROOK_TARGET}
	helm install ${DOCKER_REGISTRY_DEPLOY_CONFIG}
	touch $@

.PHONY: create-bin
create-bin:
	@mkdir -p ./bin

.PHONY: initialize
initialize: ./bin/initialize

.SECONDARY: ./bin/initialize
./bin/initialize: | create-bin ./bin/argo-workflow ${REGISTRY_TARGET} ${ROOK_TARGET} 
	touch $@

.PHONY: rook
rook:
	helm install ${ROOK_DEPLOY_CONFIG}

.PHONY: orchest_upgrade
orchest_upgrade:
	helm upgrade --install ${ORCHEST_DEPLOY_CONFIG}