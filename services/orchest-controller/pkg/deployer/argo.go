package addons

import (
	"context"
	"time"

	"github.com/orchest/orchest/services/orchest-controller/pkg/helm"
)

var (
	argoWorkFlow string = "argo"
)

type ArgoAddon struct {
	deployDir string
}

func NewArgoAddon(deployDir string) Addon {
	return &ArgoAddon{deployDir: deployDir}
}

//returns the name of the addon
func (argo *ArgoAddon) GetName() string {
	return argoWorkFlow
}

// Installs addons if the config is changed
func (argo *ArgoAddon) InstallIfChanged(ctx context.Context, namespace string, config interface{}) error {
	// First we need to check if there is already a release
	_, err := helm.GetReleaseConfig(ctx, argoWorkFlow, namespace)
	if err == nil {
		return nil
	}

	argBuilder := helm.NewHelmArgBuilder()
	args := argBuilder.WithUpgradeInstall().
		WithName(argoWorkFlow).
		WithNamespace(namespace).
		WithCreateNamespace().
		WithAtomic().WithTimeout(time.Second * 1800).
		WithRepository(argo.deployDir).Build()

	return helm.DeployRelease(ctx, args)

}

// Uninstall the addon
func (argo *ArgoAddon) Uninstall(ctx context.Context, namespace string) error {
	return helm.RemoveRelease(ctx, argoWorkFlow, namespace)
}
