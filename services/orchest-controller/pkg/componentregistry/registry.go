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
	NvidiaPlugin   = "nvidia-plugin"

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

func ReplaceComponent(name string, component Component) {
	Registry.components[name] = component
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

type AbbortEvent struct{}

func (event AbbortEvent) String() string {
	return string("Abborted")
}

type Component interface {
	// Updates the deployed component, install if not deployed yet
	Update(ctx context.Context, namespace string, message Message, eventChan chan Event)

	// Deletes the deployed component.
	Delete(ctx context.Context, namespace string, message Message, eventChan chan Event)
}

type ComponentRegistry struct {
	components map[string]Component
}

func (registry *ComponentRegistry) Deploy(ctx context.Context, name, namespace string,
	message Message, eventChan chan Event) {
	addon, ok := registry.components[name]

	if !ok {
		err := errors.New(fmt.Sprintf("Component %s is not registered with the component registry", name))
		klog.Error(err)
		eventChan <- ErrorEvent(err.Error())
		return
	}

	addon.Update(ctx, namespace, message, eventChan)
}

func (registry *ComponentRegistry) Delete(ctx context.Context, name, namespace string,
	message Message, eventChan chan Event) {
	addon, ok := registry.components[name]

	if !ok {
		err := errors.New(fmt.Sprintf("Component %s is not registered with the component registry", name))
		klog.Error(err)
		eventChan <- ErrorEvent(err.Error())
		return
	}

	addon.Delete(ctx, namespace, message, eventChan)
}
