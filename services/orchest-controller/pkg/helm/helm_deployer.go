package helm

import (
	"context"
	"time"

	"github.com/orchest/orchest/services/orchest-controller/pkg/deployer"
)

type HelmDeployer struct {
	name      string
	deployDir string
}

func NewHelmDeployer(name, deployDir string) deployer.Deployer {
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
func (d *HelmDeployer) InstallIfChanged(ctx context.Context, namespace string, valuesStruct interface{}) error {

	// First we need to check if there is already a release
	_, err := GetReleaseConfig(ctx, d.name, namespace)
	if err == nil {
		return nil
	}

	// Transform the values struct to helm values
	newValues := structToValues(valuesStruct)

	argBuilder := NewHelmArgBuilder()
	args := argBuilder.WithUpgradeInstall().
		WithName(d.name).
		WithNamespace(namespace).
		WithCreateNamespace().
		WithAtomic().WithTimeout(time.Second * 1800)

	for key, value := range newValues {
		args.WithSetValue(key, value.(string))
	}

	args.WithRepository(d.deployDir)

	return DeployRelease(ctx, args.Build())

}

// Uninstall the addon
func (d *HelmDeployer) Uninstall(ctx context.Context, namespace string) error {
	return RemoveRelease(ctx, d.name, namespace)
}
