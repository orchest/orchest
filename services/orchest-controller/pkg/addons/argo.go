package addons

import (
	"context"
	"time"

	"github.com/orchest/orchest/services/orchest-controller/pkg/helm"
)

var (
	argoWorkFlow string = "argo-workflow"
)

type ArgoDeploymentConfig struct {
}

func DeployArgoIfChanged(ctx context.Context, namespace string /*, spec *DockerRegistrySpec*/) error {

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
		WithRepository("/home/navid/go/src/github.com/orchest/orchest/deploy/thirdparty/argo-workflows").Build()

	return helm.DeployRelease(ctx, args)
}
