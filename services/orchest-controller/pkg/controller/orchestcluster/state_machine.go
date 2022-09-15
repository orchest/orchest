package orchestcluster

import (
	"context"
	"fmt"

	"github.com/orchest/orchest/services/orchest-controller/pkg/addons"
	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/controller"
	"github.com/pkg/errors"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/client-go/tools/cache"
	"k8s.io/klog/v2"
)

type StateHandler interface {
	To(ctx context.Context, stateMachine *OrchestStateMachine)
	Do(ctx context.Context, stateMachine *OrchestStateMachine, orchest *orchestv1alpha1.OrchestCluster) error
}

type OrchestStateMachine struct {
	stateHandlers map[orchestv1alpha1.OrchestPhase]StateHandler

	controller *OrchestClusterController

	//stateLock    sync.RWMutex
	currentState orchestv1alpha1.OrchestPhase

	// received events of the current state machine
	events map[orchestv1alpha1.OrchestClusterEvent]struct{}

	// Name and namespace of the OrchestCluster
	name      string
	namespace string
}

func NewOrchestStateMachine(orchestKey string,
	controller *OrchestClusterController) (*OrchestStateMachine, error) {

	namespace, name, err := cache.SplitMetaNamespaceKey(orchestKey)
	if err != nil {
		return nil, err
	}

	orchest, err := controller.oClusterLister.OrchestClusters(namespace).Get(name)
	if err != nil {
		if kerrors.IsNotFound(err) {
			klog.V(2).Info("OrchestCluster not found. name=%s, namespace=%s", name, namespace)
			return nil, nil
		}
		// Error reading OrchestCluster - The request will be requeued.
		return nil, errors.Wrapf(err, "failed to get to OrchestCluster %s", orchestKey)
	}

	sm := &OrchestStateMachine{
		name:          name,
		namespace:     namespace,
		controller:    controller,
		events:        make(map[orchestv1alpha1.OrchestClusterEvent]struct{}),
		currentState:  orchestv1alpha1.Unknown,
		stateHandlers: make(map[orchestv1alpha1.OrchestPhase]StateHandler),
	}

	sm.stateHandlers[orchestv1alpha1.Initializing] = NewInitState()
	sm.stateHandlers[orchestv1alpha1.DeployingThirdParties] = NewDeployThirdPartyState()
	sm.stateHandlers[orchestv1alpha1.DeployingOrchest] = NewDeployOrchestState()
	sm.stateHandlers[orchestv1alpha1.Updating] = NewUpdateOrchestState()
	sm.stateHandlers[orchestv1alpha1.Stopping] = NewStopOrchestState()
	sm.stateHandlers[orchestv1alpha1.Starting] = NewStartOrchestState()
	sm.stateHandlers[orchestv1alpha1.Running] = NewRunningState()
	sm.stateHandlers[orchestv1alpha1.Error] = NewErrorState()

	currentState := orchestv1alpha1.Initializing
	if orchest.Status != nil {
		currentState = orchest.Status.Phase

	}
	sm.toState(context.Background(), currentState)

	return sm, nil
}

func (sm *OrchestStateMachine) updateConditions(orchest *orchestv1alpha1.OrchestCluster) {
	if orchest.Status == nil {
		return
	}

	for _, condtion := range orchest.Status.Conditions {
		sm.events[condtion.Event] = struct{}{}
	}
}

func (sm *OrchestStateMachine) updateCondition(ctx context.Context, event orchestv1alpha1.OrchestClusterEvent) error {

	sm.events[event] = struct{}{}
	err := sm.controller.updateCondition(ctx, sm.namespace, sm.name, event)
	if err != nil {
		klog.Error(err)
		delete(sm.events, event)
		return err
	}

	return nil
}

func (sm *OrchestStateMachine) containsCondition(event orchestv1alpha1.OrchestClusterEvent) bool {
	_, ok := sm.events[event]
	return ok
}

func (sm *OrchestStateMachine) Deploy(ctx context.Context, componentName string, message any) error {
	err := sm.updateCondition(ctx, controller.GetDeployingEvent(componentName))
	if err != nil {
		klog.Error(err)
		return err
	}
	err = addons.Registry.Deploy(ctx, componentName, sm.namespace, message)

	if err == nil {
		err := sm.updateCondition(ctx, controller.GetDeployedEvent(componentName))
		if err != nil {
			klog.Error(err)
			return err
		}
	}

	return err
}

func (sm *OrchestStateMachine) toState(ctx context.Context, nextState orchestv1alpha1.OrchestPhase) error {

	//sm.stateLock.Lock()
	//defer sm.stateLock.Unlock()

	if nextState == sm.currentState {
		klog.V(2).Info("No state transition, name=%s, namespace=%s", sm.name, sm.namespace)
		return nil
	}

	nState, ok := sm.stateHandlers[nextState]
	if !ok {
		err := errors.New(fmt.Sprintf("State %s is unknown, No state transition, name=%s, namespace=%s", nextState, sm.name, sm.namespace))
		klog.Error(err)
		return err
	}

	err := sm.controller.UpdatePhase(ctx, sm.namespace, sm.name, nextState)
	if err != nil {
		klog.Error(err)
		return err
	}

	klog.Infof("Transition from %s to %s state, name=%s, namespace=%s", sm.currentState, nextState, sm.name, sm.namespace)

	sm.currentState = nextState
	nState.To(ctx, sm)

	return nil
}

func (sm *OrchestStateMachine) doState(ctx context.Context, orchest *orchestv1alpha1.OrchestCluster) error {

	return sm.stateHandlers[sm.currentState].Do(ctx, sm, orchest)
}

func (sm *OrchestStateMachine) exit(ctx context.Context) error {
	orchest, err := sm.controller.oClusterLister.OrchestClusters(sm.namespace).Get(sm.name)
	if err != nil {
		if kerrors.IsNotFound(err) {
			klog.V(2).Info("OrchestCluster not found, name=%s, namespace=%s", sm.name, sm.namespace)
			return nil
		}
		// Error reading OrchestCluster - The request will be requeued.
		return errors.Wrapf(err, "failed to get OrchestCluster, name=%s, namespace=%s", sm.name, sm.namespace)
	}

	_, err = controller.RemoveFinalizerIfPresent(ctx, sm.controller.gClient, orchest, orchestv1alpha1.Finalizer)
	return err

}

func (sm *OrchestStateMachine) manage(ctx context.Context) error {

	orchest, err := sm.controller.oClusterLister.OrchestClusters(sm.namespace).Get(sm.name)

	if err != nil {
		if kerrors.IsNotFound(err) {
			klog.V(2).Info("OrchestCluster not found, name=%s, namespace=%s", sm.name, sm.namespace)
			return nil
		}
		// Error reading OrchestCluster - The request will be requeued.
		return errors.Wrapf(err, "failed to get OrchestCluster, name=%s, namespace=%s", sm.name, sm.namespace)
	}

	if !orchest.GetDeletionTimestamp().IsZero() {
		// The cluster is deleted.
		err = sm.toState(ctx, orchestv1alpha1.Stopping)
		if err != nil {
			return err
		}
	}

	// Set a finalizer so we can do cleanup before the object goes away
	changed, err := controller.AddFinalizerIfNotPresent(ctx, sm.controller.gClient, orchest, orchestv1alpha1.Finalizer)
	if changed || err != nil {
		return err
	}

	ok, err := sm.controller.validateOrchestCluster(ctx, orchest)
	if err != nil {
		klog.Error(err)
		return err
	}

	if !ok {
		return sm.toState(ctx, orchestv1alpha1.Error)
	}

	changed, err = sm.controller.setDefaultIfNotSpecified(ctx, orchest)
	if err != nil {
		return err
	}
	// If the object is changed, we return and the object will be requeued.
	if changed {
		return nil
	}

	return sm.doState(ctx, orchest)
}
