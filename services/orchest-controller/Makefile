
TAG:=orchest/orchest-controller

TOOLS_DIR := $(PWD)/.cache/tools

CONTROLLER_GEN=$(TOOLS_DIR)/controller-gen

GO_PROJECT=github.com/orchest/orchest/services/orchest-controller

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
	CGO_ENABLED=0 GOOS=linux go build -o bin/controller ./cmd/controller

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
	@if [ -z "${TAGNAME}" ] ; then echo "TAGNAME must be set" ; exit 1 ; fi
	@mkdir -p deploy/k8s

	@echo Generating orchest-controller.yaml manifests
	@helm template --create-namespace --namespace ${NAMESPACE} \
		--set image.tag=${TAGNAME} ./deploy/helm > deploy/k8s/orchest-controller.yaml
