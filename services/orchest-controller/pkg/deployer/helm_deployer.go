package deployer

import (
	"context"
	"time"

	"github.com/orchest/orchest/services/orchest-controller/pkg/helm"
)

type HelmDeployer struct {
	name      string
	deployDir string
}

func NewHelmDeployer(name, deployDir string) Deployer {
	return &HelmDeployer{
		name:      name,
		deployDir: deployDir,
	}
}

//returns the name of the deployer
func (d *HelmDeployer) GetName() string {
	return d.name
}

// Installs deployer if the config is changed
func (d *HelmDeployer) InstallIfChanged(ctx context.Context, namespace string, config interface{}) error {
	// First we need to check if there is already a release
	_, err := helm.GetReleaseConfig(ctx, d.name, namespace)
	if err == nil {
		return nil
	}

	argBuilder := helm.NewHelmArgBuilder()
	args := argBuilder.WithUpgradeInstall().
		WithName(d.name).
		WithNamespace(namespace).
		WithCreateNamespace().
		WithAtomic().WithTimeout(time.Second * 1800).
		WithRepository(d.deployDir).Build()

	return helm.DeployRelease(ctx, args)

}

// Uninstall the addon
func (d *HelmDeployer) Uninstall(ctx context.Context, namespace string) error {
	return helm.RemoveRelease(ctx, d.name, namespace)
}
