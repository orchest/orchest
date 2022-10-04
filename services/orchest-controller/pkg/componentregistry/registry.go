package componentregistry

import (
	"context"
	"errors"
	"fmt"

	"k8s.io/klog/v2"
)

var (
	// list of all addons
	ArgoWorkflow   = "argo-workflow"
	DockerRegistry = "docker-registry"
	IngressNginx   = "ingress-nginx"

	Registry = ComponentRegistry{
		components: make(map[string]Component),
	}
)

type ComponentsConfig struct {

	// The list of components to enable
	Components []string

	AssetDir string

	DefaultNamespace string
}

func NewDefaultComponentsConfig() ComponentsConfig {
	return ComponentsConfig{
		Components: []string{},

		AssetDir: "/deploy",

		DefaultNamespace: "orchest",
	}
}

func RegisterComponent(name string, component Component) {
	if _, ok := Registry.components[name]; !ok {
		Registry.components[name] = component
		klog.Infof("Component %s is registered with the registry", name)
		return
	}

	klog.Infof("A Component with the same name is already registered with the registry, name=%s", name)
}

type Message any

type Event interface {
	String() string
}

type LogEvent string

func (event LogEvent) String() string {
	return string(event)
}

type ErrorEvent string

func (event ErrorEvent) String() string {
	return string(event)
}

type SuccessEvent struct{}

func (event SuccessEvent) String() string {
	return string("Success")
}

type TimeOutEvent string

func (event TimeOutEvent) String() string {
	return string(event)
}

type Component interface {
	// Updates the deployed component, install if not deployed yet
	Update(ctx context.Context, namespace string, message Message, eventChan chan Event)

	// Stops the deployed component
	Stop(ctx context.Context, namespace string, message Message, eventChan chan Event)

	// Starts the stopped component
	Start(ctx context.Context, namespace string, message Message, eventChan chan Event)

	// Deletes the deployed component.
	Delete(ctx context.Context, namespace string, message Message, eventChan chan Event)
}

type ComponentRegistry struct {
	components map[string]Component
}

func (registery *ComponentRegistry) Deploy(ctx context.Context, name, namespace string,
	message Message, eventChan chan Event) {
	addon, ok := registery.components[name]

	if !ok {
		err := errors.New(fmt.Sprintf("Component %s is not registered with the component registry", name))
		klog.Error(err)
		eventChan <- ErrorEvent(err.Error())
		return
	}

	addon.Update(ctx, namespace, message, eventChan)
}
