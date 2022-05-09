package deployer

import (
	"context"
	"time"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"

	"github.com/orchest/orchest/services/orchest-controller/pkg/helm"
)

type HelmDeployer struct {
	name       string
	deployDir  string
	valuesPath string
}

func NewHelmDeployer(name, deployDir string, valuesPath string) Deployer {
	return &HelmDeployer{
		name:       name,
		deployDir:  deployDir,
		valuesPath: valuesPath,
	}
}

// Installs deployer if the config is changed
func (d *HelmDeployer) InstallIfChanged(ctx context.Context, namespace string,
	orchest *orchestv1alpha1.OrchestCluster) error {

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
		WithName(d.name).
		WithNamespace(namespace).
		WithCreateNamespace().
		WithAtomic().WithTimeout(time.Second * 180)

	if d.valuesPath != "" {
		args.WithValuesFile(d.valuesPath)
	}

	/*
		for key, value := range newValues {
			args.WithSetValue(key, value.(string))
		}
	*/

	args.WithRepository(d.deployDir)

	return helm.DeployRelease(ctx, args.Build())

}

// Uninstall the addon
func (d *HelmDeployer) Uninstall(ctx context.Context, namespace string) error {
	return helm.RemoveRelease(ctx, d.name, namespace)
}
