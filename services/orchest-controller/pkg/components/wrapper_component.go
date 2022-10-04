package components

import (
	"context"

	registry "github.com/orchest/orchest/services/orchest-controller/pkg/componentregistry"
)

type preInstallHook func(app registry.Message, namespace string, eventChan chan registry.Event) error

type WrapperComponent struct {
	name            string
	innerComponent  registry.Component
	preInstallHooks []preInstallHook
}

func NewWrapperComponent(name string, preInstallHooks []preInstallHook, innerComponent registry.Component,
) registry.Component {

	return &WrapperComponent{
		name:            name,
		innerComponent:  innerComponent,
		preInstallHooks: preInstallHooks,
	}
}

func (c *WrapperComponent) Update(ctx context.Context, namespace string,
	message registry.Message, eventChan chan registry.Event) {

	var err error

	// The success is already sent by the inner component, if there is
	defer func() {
		if err != nil {
			eventChan <- registry.ErrorEvent(err.Error())
		}
	}()

	for _, preInstall := range c.preInstallHooks {
		err = preInstall(message, namespace, eventChan)
		if err != nil {
			break
		}
	}

	c.innerComponent.Update(ctx, namespace, message, eventChan)

	return
}

func (c *WrapperComponent) Stop(ctx context.Context, namespace string,
	message registry.Message, eventChan chan registry.Event) {
	return
}

func (c *WrapperComponent) Start(ctx context.Context, namespace string,
	message registry.Message, eventChan chan registry.Event) {
	return
}

func (c *WrapperComponent) Delete(ctx context.Context, namespace string,
	message registry.Message, eventChan chan registry.Event) {
}
