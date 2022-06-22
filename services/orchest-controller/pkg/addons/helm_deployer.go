package addons

import (
	"context"
	"fmt"
	"time"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"

	"github.com/orchest/orchest/services/orchest-controller/pkg/helm"
)

type HelmDeployer struct {
	name       string
	deployDir  string
	valuesPath string
}

func NewHelmDeployer(name, deployDir string, valuesPath string) Addon {
	return &HelmDeployer{
		name:       name,
		deployDir:  deployDir,
		valuesPath: valuesPath,
	}
}

// Installs deployer if the config is changed
func (d *HelmDeployer) Enable(ctx context.Context, namespace string,
	config *orchestv1alpha1.ApplicationConfig) error {

	// First we need to check if there is already a release
	_, err := helm.GetReleaseConfig(ctx, d.name, namespace)
	if err == nil {
		return nil
	}

	/*
		// Transform the values struct to helm values
		newValues := helm.StructToValues(valuesStruct)
	*/

	argBuilder := helm.NewHelmArgBuilder()
	args := argBuilder.WithUpgradeInstall().
		WithName(fmt.Sprintf("%s-%s", namespace, d.name)).
		WithNamespace(namespace).
		WithCreateNamespace().
		WithAtomic().WithTimeout(time.Second * 180)

	if d.valuesPath != "" {
		args.WithValuesFile(d.valuesPath)
	}

	if config.Helm != nil && config.Helm.Parameters != nil {
		for _, parameter := range config.Helm.Parameters {
			args.WithSetValue(parameter.Name, parameter.Value)
		}
	}

	args.WithRepository(d.deployDir)

	return helm.DeployRelease(ctx, args.Build())

}

// Uninstall the addon
func (d *HelmDeployer) Uninstall(ctx context.Context, namespace string) error {
	return helm.RemoveRelease(ctx, d.name, namespace)
}
