package orchestcluster

import (
	"context"
	"fmt"
	"time"

	"github.com/orchest/orchest/services/orchest-controller/pkg/addons"
	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/controller"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	"github.com/pkg/errors"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/client-go/tools/cache"
	"k8s.io/klog/v2"
)

type StateHandler interface {
	To(ctx context.Context, stateMachine *OrchestStateMachine)
	Do(ctx context.Context, stateMachine *OrchestStateMachine, orchest *orchestv1alpha1.OrchestCluster) error
}

type requestInfo struct {
	timeoutFn    *time.Timer
	responseChan chan addons.Event
	retryCount   int
}

type responseInfo struct {
	responseEvent addons.Event
	requestEvent  string
}

type OrchestStateMachine struct {
	stateHandlers map[orchestv1alpha1.OrchestPhase]StateHandler

	controller *OrchestClusterController

	//stateLock    sync.RWMutex
	currentState orchestv1alpha1.OrchestPhase

	// the map of requests sent to components the the requestInfo
	requests map[string]*requestInfo

	responseChan chan *responseInfo
	// the cancel function of the context of this state machine
	cancel context.CancelFunc

	orchestChan chan *orchestv1alpha1.OrchestCluster

	// Name and namespace, and key of the OrchestCluster
	key       string
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
		key:           orchestKey,
		name:          name,
		namespace:     namespace,
		controller:    controller,
		responseChan:  make(chan addons.Event, 10),
		orchestChan:   make(chan *orchestv1alpha1.OrchestCluster, 10),
		requests:      make(map[string]*requestInfo),
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

	klog.Infof("StateMachine started, name=%s, namespace=%s", sm.name, sm.namespace)

	sm.toState(context.Background(), currentState)

	return sm, nil
}

/*
func (sm *OrchestStateMachine) updateConditions(orchest *orchestv1alpha1.OrchestCluster) {
	if orchest.Status == nil {
		return
	}

	for _, condtion := range orchest.Status.Conditions {
		sm.requests[condtion.Event] = struct{}{}
	}
}
*/

func (sm *OrchestStateMachine) updateCondition(ctx context.Context, event string,
	timeout time.Duration, retryCount int) error {

	responseChan := make(chan addons.Event)
	sm.requests[event] = &requestInfo{
		timeoutFn: time.AfterFunc(timeout, func() {
			sm.responseChan <- &responseInfo{
				responseEvent: addons.ErrorEvent("Timeout"),
				requestEvent:  event,
			}
		}),
		retryCount:   retryCount,
		responseChan: responseChan,
	}

	err := sm.controller.updateCondition(ctx, sm.namespace, sm.name, event)
	if err != nil {
		klog.Error(err)
		delete(sm.requests, event)
		return err
	}

	return nil
}

func (sm *OrchestStateMachine) containsCondition(event string) bool {
	_, ok := sm.requests[event]
	return ok
}

func (sm *OrchestStateMachine) Deploy(ctx context.Context, componentName string,
	timeout time.Duration, retryCount int, message any) error {
	err := sm.updateCondition(ctx, utils.GetDeployingEvent(componentName), timeout, retryCount)
	if err != nil {
		klog.Error(err)
		return err
	}
	go addons.Registry.Deploy(ctx, componentName, sm.namespace, message, sm.eventChan)

	/*
		if err == nil {
			err := sm.updateCondition(ctx, controller.GetDeployedEvent(componentName))
			if err != nil {
				klog.Error(err)
				return err
			}
		}

		return err
	*/
	return nil
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

	if err == nil {
		sm.cancel()
	}

	return err

}

func (sm *OrchestStateMachine) run(ctx context.Context) {
	defer func() {
		// Clean up.
		sm.controller.removeOrchestCluster(sm.key)
	}()

	ctx, sm.cancel = context.WithCancel(ctx)
loop:
	for true {
		select {
		case <-ctx.Done():
			break loop
		case event := <-sm.eventChan:
			sm.updateCondition(ctx, event)
		case orchest := <-sm.orchestChan:
			sm.doState(ctx, orchest)
		}
	}

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

	sm.orchestChan <- orchest

	return nil
}
