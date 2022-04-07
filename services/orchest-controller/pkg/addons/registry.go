package addons

import (
	"context"
	"time"

	"github.com/orchest/orchest/services/orchest-controller/pkg/helm"
)

var (
	registryName string = "registry"
)

type RegistrySpec struct {

	// The Secret used for tls, if nil, tls will be disabled.
	SecretName string

	// The Name of the registry deployment.
	RegistryName string

	// The port of registry service
	RegistryPort int

	// The Volume size of docker registry
	VolumeSize string

	// The Storage class of the PVC used for docker-registry
	StorageClass string
}

/*
func JsonToStruct(j helm.Json, v interface{}) RegistrySpec {

	data, err := json.Marshal(j)
	if err == nil {
		err = json.Unmarshal(data, v)
	}
	return err
	return RegistrySpec{
		SecretName:   j["tlsSecretName"],
		RegistryName: j["fullnameOverride"],
		VolumeSize:   j["persistence"]["size"],
	}
}

func configToRegistrySpec(config helm.Json) RegistrySpec {
	return RegistrySpec{
		SecretName: config,
	}
}
*/

func DeployRegistryIfChanged(ctx context.Context, namespace string /*, spec *DockerRegistrySpec*/) error {

	// First we need to check if there is already a release
	_, err := helm.GetReleaseConfig(ctx, registryName, namespace)
	if err == nil {
		return nil
	}

	argBuilder := helm.NewHelmArgBuilder()
	args := argBuilder.WithUpgradeInstall().
		WithName(registryName).
		WithNamespace(namespace).
		WithCreateNamespace().
		WithAtomic().WithTimeout(time.Second*1800).
		//WithSetValue("tlsSecretName", "registry-tls-secret").
		WithSetValue("fullnameOverride", "docker-registry").
		WithSetValue("service.port", "443").
		WithSetValue("persistence.size", "999Ti").
		WithSetValue("persistence.enabled", "true").
		WithRepository("/home/navid/go/src/github.com/orchest/orchest/deploy/thirdparty/docker-registry").Build()

	return helm.DeployRelease(ctx, args)
}
