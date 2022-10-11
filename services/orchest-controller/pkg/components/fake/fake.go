package components

import (
	"context"

	registry "github.com/orchest/orchest/services/orchest-controller/pkg/componentregistry"
)

type FakeComponent struct {
	update func(context.Context, string, registry.Message, chan registry.Event)
}

func healthyUpdate(ctx context.Context, ns string, msg registry.Message, eventChan chan registry.Event) {
	eventChan <- registry.SuccessEvent{}
}

func faultyUpdate(ctx context.Context, ns string, msg registry.Message, eventChan chan registry.Event) {
	eventChan <- registry.ErrorEvent("faulty component can not deploy anything")
}

func newFakeComponent(update func(context.Context, string, registry.Message, chan registry.Event)) registry.Component {

	return &FakeComponent{
		update: update,
	}
}

func NewHealthyComponent() registry.Component {
	return newFakeComponent(healthyUpdate)
}

func NewFaultyComponent() registry.Component {
	return newFakeComponent(faultyUpdate)
}

func (c *FakeComponent) Update(ctx context.Context, namespace string,
	message registry.Message, eventChan chan registry.Event) {
	c.update(ctx, namespace, message, eventChan)
	return
}

func (c *FakeComponent) Stop(ctx context.Context, namespace string,
	message registry.Message, eventChan chan registry.Event) {
	return
}

func (c *FakeComponent) Start(ctx context.Context, namespace string,
	message registry.Message, eventChan chan registry.Event) {
	return
}

func (c *FakeComponent) Delete(ctx context.Context, namespace string,
	message registry.Message, eventChan chan registry.Event) {
}
