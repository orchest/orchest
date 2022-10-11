package orchestcluster

import (
	"context"
	"fmt"
	"strings"
	"time"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	registry "github.com/orchest/orchest/services/orchest-controller/pkg/componentregistry"
	"github.com/orchest/orchest/services/orchest-controller/pkg/controller"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	"github.com/pkg/errors"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/client-go/tools/cache"
	"k8s.io/klog/v2"
)

var (
	deployTimeOut = time.Minute * 5
	deployRetry   = 5
	deleteRetry   = 5
)

type StateHandler interface {
	To(ctx context.Context, stateMachine *OrchestStateMachine)
	Do(ctx context.Context, stateMachine *OrchestStateMachine, orchest *orchestv1alpha1.OrchestCluster) error
}

type requestInfo struct {
	timeoutFn    *time.Timer
	responseChan chan registry.Event
	retryCount   int
}

type responseInfo struct {
	componentName string
	message       any
	retryCount    int
	responseEvent registry.Event
	requestEvent  string
}

type OrchestStateMachine struct {
	stateHandlers map[orchestv1alpha1.OrchestPhase]StateHandler

	controller *OrchestClusterController

	//stateLock    sync.RWMutex
	currentState orchestv1alpha1.OrchestPhase

	// the map of requests sent to components
	requests map[string]struct{}

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
		responseChan:  make(chan *responseInfo, 20),
		orchestChan:   make(chan *orchestv1alpha1.OrchestCluster, 20),
		requests:      make(map[string]struct{}),
		currentState:  orchestv1alpha1.Unknown,
		stateHandlers: make(map[orchestv1alpha1.OrchestPhase]StateHandler),
	}

	sm.stateHandlers[orchestv1alpha1.Initializing] = NewInitState()
	sm.stateHandlers[orchestv1alpha1.DeployingThirdParties] = NewDeployThirdPartyState()
	sm.stateHandlers[orchestv1alpha1.DeployingOrchest] = NewDeployOrchestState()
	sm.stateHandlers[orchestv1alpha1.Updating] = NewUpdateOrchestState()
	sm.stateHandlers[orchestv1alpha1.Stopping] = NewStopOrchestState()
	sm.stateHandlers[orchestv1alpha1.Stopped] = NewStoppedOrchestState()
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

func (sm *OrchestStateMachine) updateCondition(ctx context.Context, event string) error {

	sm.requests[event] = struct{}{}
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

func (sm *OrchestStateMachine) isDeleted() bool {
	orchest, err := sm.controller.oClusterLister.OrchestClusters(sm.namespace).Get(sm.name)
	if err != nil {
		if kerrors.IsNotFound(err) {
			klog.V(2).Info("OrchestCluster not found, name=%s, namespace=%s", sm.name, sm.namespace)
			return false
		}
		// Error reading OrchestCluster - The request will be requeued.
		return false
	}
	return !orchest.GetDeletionTimestamp().IsZero()
}

func (sm *OrchestStateMachine) Create(ctx context.Context, componentName string,
	deployingEvent string, timeout time.Duration, retryCount int, message any) error {

	klog.Infof("Creating %s, namespace=%s, name=%s retry=%d", componentName, sm.namespace, sm.name, retryCount)
	timeoutTimer := time.NewTimer(timeout)
	responseChan := make(chan registry.Event)
	sm.requests[deployingEvent] = struct{}{}
	go func() {
	loop:
		for {
			select {
			case event := <-responseChan:
				klog.V(2).Infof("received event for component %s, event= %s", componentName, event)
				switch event.(type) {
				case registry.LogEvent:
					sm.responseChan <- &responseInfo{
						componentName: componentName,
						message:       message,
						requestEvent:  deployingEvent,
						retryCount:    retryCount,
						responseEvent: event,
					}

				case registry.ErrorEvent, registry.SuccessEvent:
					sm.responseChan <- &responseInfo{
						componentName: componentName,
						message:       message,
						requestEvent:  deployingEvent,
						retryCount:    retryCount,
						responseEvent: event,
					}
					break loop
				default:
					sm.responseChan <- &responseInfo{
						requestEvent:  deployingEvent,
						responseEvent: registry.ErrorEvent("Unrecognized event"),
						componentName: componentName,
						message:       message,
						retryCount:    retryCount,
					}
					break loop
				}
			case <-timeoutTimer.C:
				klog.V(2).Info("received timeout for component ", componentName)
				sm.responseChan <- &responseInfo{
					requestEvent:  deployingEvent,
					responseEvent: registry.TimeOutEvent(fmt.Sprintf("Timeout in deploying %s", componentName)),
					componentName: componentName,
					message:       message,
					retryCount:    retryCount,
				}
				break loop
			}
		}
	}()

	err := sm.updateCondition(ctx, deployingEvent)
	if err != nil {
		klog.Error(err)
		return err
	}
	go registry.Registry.Deploy(ctx, componentName, sm.namespace, message, responseChan)

	return nil
}

func (sm *OrchestStateMachine) Delete(ctx context.Context, componentName string,
	deletingEvent string, retryCount int, message any) error {

	klog.Infof("Deleting %s, namespace=%s, name=%s", componentName, sm.namespace, sm.name)
	responseChan := make(chan registry.Event)
	sm.requests[deletingEvent] = struct{}{}
	go func() {
	loop:
		for {
			select {
			case event := <-responseChan:
				klog.V(2).Infof("received event for component %s, event= %s", componentName, event)
				switch event.(type) {
				case registry.LogEvent:
					sm.responseChan <- &responseInfo{
						componentName: componentName,
						message:       message,
						requestEvent:  deletingEvent,
						retryCount:    retryCount,
						responseEvent: event,
					}

				case registry.ErrorEvent, registry.SuccessEvent:
					sm.responseChan <- &responseInfo{
						componentName: componentName,
						message:       message,
						requestEvent:  deletingEvent,
						retryCount:    retryCount,
						responseEvent: event,
					}
					break loop
				default:
					sm.responseChan <- &responseInfo{
						requestEvent:  deletingEvent,
						responseEvent: registry.ErrorEvent("Unrecognized event"),
						componentName: componentName,
						message:       message,
						retryCount:    retryCount,
					}
					break loop
				}
			}
		}
	}()

	err := sm.updateCondition(ctx, deletingEvent)
	if err != nil {
		klog.Error(err)
		return err
	}
	go registry.Registry.Delete(ctx, componentName, sm.namespace, message, responseChan)

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
		case info := <-sm.responseChan:
			switch info.responseEvent.(type) {
			case registry.LogEvent:
				sm.updateCondition(ctx, info.responseEvent.String())
			case registry.ErrorEvent, registry.TimeOutEvent:
				_, ok := sm.requests[info.requestEvent]
				if !ok {
					klog.Errorf("The requested event does not exist, event= %s", info.requestEvent)
				}

				sm.updateCondition(ctx, info.responseEvent.String())

				if info.retryCount == 1 {
					sm.toState(context.Background(), orchestv1alpha1.Error)
				} else {
					// If it Deleting event, delete again
					if strings.HasPrefix(info.requestEvent, "Deleting") {
						sm.Delete(ctx, info.componentName, info.requestEvent, info.retryCount-1, info.message)
					} else { // otherwise it is Creating event, we need to create it again
						sm.Create(ctx, info.componentName, info.requestEvent, deployTimeOut, info.retryCount-1, info.message)
					}
				}
			case registry.SuccessEvent:
				orchest, err := sm.controller.oClusterLister.OrchestClusters(sm.namespace).Get(sm.name)
				if err != nil {
					klog.Error("failed to get OrchestCluster, name=%s, namespace=%s", sm.name, sm.namespace)
				}
				// If it Deleting event, we update with deleted event
				if strings.HasPrefix(info.requestEvent, "Deleting") {
					sm.updateCondition(ctx, utils.GetDeletedEvent(info.componentName))
				} else { // otherwise it is Creating event, we need to create it again
					sm.updateCondition(ctx, utils.GetCreatedEvent(info.componentName))
				}
				// we call the doState again, to see if it is time to move to the next state
				sm.orchestChan <- orchest
			default:
				klog.Errorf("Unrecognized event received for OrchestCluster, name=%s, namespace=%s, %s", sm.name, sm.namespace, info.responseEvent.String())
			}
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

	if !orchest.GetDeletionTimestamp().IsZero() && orchest.Status.Phase != orchestv1alpha1.Stopped {
		// The cluster is deleted.
		err = sm.toState(ctx, orchestv1alpha1.Stopping)
		if err != nil {
			return err
		}
	}

	// Set a finalizer so we can do cleanup before the object goes away
	changed, err := controller.AddFinalizerIfNotPresent(ctx, sm.controller.oClient, orchest, orchestv1alpha1.Finalizer)
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

	if orchest.Spec.Orchest.Pause != nil &&
		*orchest.Spec.Orchest.Pause &&
		orchest.Status.Phase != orchestv1alpha1.Stopped {
		return sm.toState(ctx, orchestv1alpha1.Stopping)
	} else if _, ok := orchest.GetAnnotations()[controller.RestartAnnotationKey]; ok {
		return sm.toState(ctx, orchestv1alpha1.Stopping)
	} else if orchest.Status.ObservedGeneration != orchest.Generation {
		// If the hash is changed, the cluster enters upgrading state and then running
		return sm.toState(ctx, orchestv1alpha1.Updating)
	}

	sm.orchestChan <- orchest

	return nil
}
