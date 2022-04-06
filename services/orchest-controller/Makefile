


TOOLS_DIR := $(PWD)/.cache/tools

CONTROLLER_GEN=$(TOOLS_DIR)/controller-gen
YQ=$(TOOLS_DIR)/yq-v3

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

.SECONDARY: $(YQ)
$(YQ):
	set -e ;\
	mkdir -p $(TOOLS_DIR) ;\
	CONTROLLER_GEN_TMP_DIR=$$(mktemp -d) ;\
	cd $$CONTROLLER_GEN_TMP_DIR ;\
	pwd;\
	go mod init tmp;\
	unset GOOS GOARCH ;\
	export CGO_ENABLED=0 ;\
	export GOBIN=$$CONTROLLER_GEN_TMP_DIR ;\
	echo === installing yq ;\
	go install github.com/mikefarah/yq/v3@latest;\
	mv $$CONTROLLER_GEN_TMP_DIR/yq $(YQ) ;\
	rm -rf $$CONTROLLER_GEN_TMP_DIR ;\


.PHONY: crds
crds: $(CONTROLLER_GEN) $(YQ)
	@echo Updating CRD manifests
	$(CONTROLLER_GEN) crd paths=./pkg/apis/... output:dir=.cache  	
	@$(YQ) read .cache/orchest.io_orchestclusters.yaml >> deploy/crds.yaml
	@rm -f .cache/orchest.io_orchestclusters.yaml

.PHONY: codegen
codegen:
	@./hack/update-codegen.sh