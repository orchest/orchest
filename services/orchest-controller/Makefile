
TAGNAME:=$(if $(TAGNAME),$(TAGNAME),"latest")
TAG:=orchest/orchest-controller:$(TAGNAME)

TOOLS_DIR := $(PWD)/.cache/tools

CONTROLLER_GEN=$(TOOLS_DIR)/controller-gen

GO_PROJECT=github.com/orchest/orchest/services/orchest-controller

# inject the version number into the golang version package
LDFLAGS := ${if ${ORCHEST_VERSION},-X $(GO_PROJECT)/pkg/version.Version=$(ORCHEST_VERSION),}

NAMESPACE := ${if ${NAMESPACE},${NAMESPACE},orchest}

SOURCE_DIRS = cmd pkg

.PHONY: docker
docker:
	@docker build --rm -t $(TAG) . -f Dockerfile

.PHONY: fmt
fmt: ## Run go fmt and modify files in place
	@gofmt -s -w ${SOURCE_DIRS}

.PHONY: controller
controller: fmt
	CGO_ENABLED=0 GOOS=linux go build -ldflags="$(LDFLAGS)" -o bin/controller ./cmd/controller

.SECONDARY: $(CONTROLLER_GEN)
$(CONTROLLER_GEN):
	set -e ;\
	mkdir -p $(TOOLS_DIR) ;\
	CONTROLLER_GEN_TMP_DIR=$$(mktemp -d) ;\
	cd $$CONTROLLER_GEN_TMP_DIR ;\
	pwd;\
	go mod init tmp;\
	unset GOOS GOARCH ;\
	export CGO_ENABLED=0 ;\
	export GOBIN=$$CONTROLLER_GEN_TMP_DIR ;\
	echo === installing controller-gen ;\
	go install sigs.k8s.io/controller-tools/cmd/controller-gen@latest;\
	mv $$CONTROLLER_GEN_TMP_DIR/controller-gen $(CONTROLLER_GEN) ;\
	rm -rf $$CONTROLLER_GEN_TMP_DIR ;\

.PHONY: crds
crds: $(CONTROLLER_GEN)
	@echo Updating CRD manifests
	$(CONTROLLER_GEN) crd paths=./pkg/apis/... output:dir=deploy/helm/templates

.PHONY: codegen
codegen:
	@./hack/update-codegen.sh

.PHONY: manifestgen
manifestgen: crds
	@mkdir -p deploy/k8s

	@echo Generating orchest-controller.yaml manifests
	@helm template --create-namespace --namespace ${NAMESPACE} \
		--set image.tag=${TAGNAME} ./deploy/helm > deploy/k8s/orchest-controller.yaml

	@echo Generating orchest-controller-disable-argo.yaml manifests	
	helm template --create-namespace --namespace ${NAMESPACE} \
		--set addons.enableArgo=false --set image.tag=${TAGNAME} \
		./deploy/helm > deploy/k8s/orchest-controller-disable-argo.yaml
