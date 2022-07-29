package addons

import (
	"context"
	"fmt"
	"strings"
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
func (d *HelmDeployer) Enable(ctx context.Context, preInstallHooks []PreInstallHookFn,
	namespace string,
	config *orchestv1alpha1.ApplicationConfig) error {

	releaseName := fmt.Sprintf("%s-%s", namespace, d.name)

	// Generate the deploy args
	deployArgsBuilder := helm.NewHelmArgBuilder()
	deployArgs := deployArgsBuilder.WithName(releaseName).
		WithNamespace(namespace).
		WithCreateNamespace().
		WithAtomic().WithTimeout(time.Second * 180)

	if d.valuesPath != "" {
		deployArgs.WithValuesFile(d.valuesPath)
	}

	if config.Helm != nil && config.Helm.Parameters != nil {
		for _, parameter := range config.Helm.Parameters {
			deployArgs.WithSetValue(parameter.Name, parameter.Value)
		}
	}

	deployArgs.WithRepository(d.deployDir)

	// First, we need to check if there is already a release, and if yes get the manifests stored
	// in helm-related secret, and if the manifest can not be found, we will deploy the release
	oldConfig, err := helm.GetReleaseConfig(ctx, releaseName, namespace)
	if err == nil {
		// oldConfig exists, check if an update is required by getting the new config and comparing
		// it to the old config, if the manifest is the same, no update is required.

		// helm template generates the manifest without connecting to the k8s API server
		newConfig, err := helm.RunCommand(ctx, deployArgs.WithTemplate().Build())
		if err != nil {
			// Failed to get new config, probably it is best to not update
			return err
		}
		// Unfortunately, the value returned from helm get manifest has 1 extra byte,
		// so we need to trim it off.
		if strings.TrimSpace(newConfig) == strings.TrimSpace(oldConfig) {
			// There is no need for update, return without err
			return nil
		}
	}

	for _, preInstall := range preInstallHooks {
		err = preInstall(config)
		if err != nil {
			return nil
		}
	}

	_, err = helm.RunCommand(ctx, deployArgs.WithUpgradeInstall().Build())
	return err

}

// Uninstall the addon
func (d *HelmDeployer) Uninstall(ctx context.Context, namespace string) error {
	return helm.RemoveRelease(ctx, d.name, namespace)
}
