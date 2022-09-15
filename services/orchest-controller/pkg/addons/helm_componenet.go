package addons

import (
	"context"
	"fmt"
	"strings"
	"time"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/helm"
	"k8s.io/client-go/kubernetes"
)

type HelmComponent struct {
	name       string
	deployDir  string
	valuesPath string
	client     kubernetes.Interface
}

func RegisterHelmAddon(client kubernetes.Interface,
	name, deployDir string,
	valuesPath string) error {

	component := &HelmComponent{
		name:       name,
		client:     client,
		deployDir:  deployDir,
		valuesPath: valuesPath,
	}

	RegisterAddon(name, component)

	return nil
}

func (c *HelmComponent) getReleaseName(namespace string) string {
	return fmt.Sprintf("%s-%s", namespace, c.name)
}

func (c *HelmComponent) Update(ctx context.Context, namespace string, message Message) error {
	releaseName := c.getReleaseName(namespace)

	// Generate the deploy args
	deployArgsBuilder := helm.NewHelmArgBuilder()
	deployArgs := deployArgsBuilder.WithName(releaseName).
		WithNamespace(namespace).
		WithCreateNamespace().
		WithAtomic().WithTimeout(time.Second * 180)

	if c.valuesPath != "" {
		deployArgs.WithValuesFile(c.valuesPath)
	}

	app, ok := message.(*orchestv1alpha1.ApplicationSpec)
	if !ok {
		return fmt.Errorf("Component %s requires message of type *orchestv1alpha1.ApplicationSpec", c.name)
	}

	if app != nil && app.Config.Helm != nil && app.Config.Helm.Parameters != nil {
		for _, parameter := range app.Config.Helm.Parameters {
			deployArgs.WithSetValue(parameter.Name, parameter.Value)
		}
	}

	deployArgs.WithRepository(c.deployDir)

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

		err = helm.RemoveHelmHistoryIfNeeded(ctx, c.client, releaseName, namespace)
		if err != nil {
			return err
		}

	}

	/*
		for _, preInstall := range preInstallHooks {
			err = preInstall(app)
			if err != nil {
				return err
			}
		}
	*/

	_, err = helm.RunCommand(ctx, deployArgs.WithUpgradeInstall().Build())
	return err
}

func (c *HelmComponent) Stop(ctx context.Context, namespace string, message Message) error {
	return nil
}

func (c *HelmComponent) Start(ctx context.Context, namespace string, message Message) error {
	return nil
}

func (c *HelmComponent) Delete(ctx context.Context, namespace string, message Message) error {
	return helm.RemoveRelease(ctx, c.getReleaseName(namespace), namespace)
}
