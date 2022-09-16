package addons

import (
	"context"
	"errors"
	"fmt"
	"path"

	"k8s.io/client-go/kubernetes"
	"k8s.io/klog/v2"
)

var (
	Registry = AddonRegistry{
		addons: make(map[string]Addon),
	}
)

func RegisterAddon(name string, addon Addon) {
	if _, ok := Registry.addons[name]; !ok {
		Registry.addons[name] = addon
		klog.Infof("Addon %s is registered with the registry", name)
		return
	}

	klog.Infof("An Addon with the same name is already registered with the registry, name=%s", name)
}

type Message any

type Event interface {
	String() string
}

type LogEvent (string)

func (event LogEvent) String() string {
	return string(event)
}

type ErrorEvent (string)

func (event ErrorEvent) String() string {
	return string(event)
}

type Addon interface {
	// Updates the deployed component, install if not deployed yet
	Update(ctx context.Context, namespace string, message Message, eventChan chan Event)

	// Stops the deployed component
	Stop(ctx context.Context, namespace string, message Message, eventChan chan Event)

	// Starts the stopped component
	Start(ctx context.Context, namespace string, message Message, eventChan chan Event)

	// Deletes the deployed component.
	Delete(ctx context.Context, namespace string, message Message, eventChan chan Event)
}

type AddonRegistry struct {
	addons map[string]Addon
}

func InitThirdPartyAddons(client kubernetes.Interface, config AddonsConfig) {

	RegisterHelmAddon(client, ArgoWorkflow,
		path.Join(config.AssetDir, "thirdparty/argo-workflows/helm"),
		path.Join(config.AssetDir, "thirdparty/argo-workflows/orchest-values.yaml"))

	RegisterHelmAddon(client, DockerRegistry,
		path.Join(config.AssetDir, "thirdparty/docker-registry/helm"),
		path.Join(config.AssetDir, "thirdparty/docker-registry/orchest-values.yaml"))

	RegisterHelmAddon(client, IngressNginx,
		path.Join(config.AssetDir, "thirdparty/ingress-nginx/helm"),
		path.Join(config.AssetDir, "thirdparty/ingress-nginx/orchest-values.yaml"))

}

func (registery *AddonRegistry) Deploy(ctx context.Context, name, namespace string,
	message Message, eventChan chan Event) {
	addon, ok := registery.addons[name]

	if !ok {
		err := errors.New(fmt.Sprintf("Component %s is not registered with the component registry", name))
		klog.Error(err)
		eventChan <- ErrorEvent(err.Error())
		return
	}

	addon.Update(ctx, namespace, message, eventChan)
}
