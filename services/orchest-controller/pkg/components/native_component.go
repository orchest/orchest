package components

import (
	"fmt"
	"sync"
	"time"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	registry "github.com/orchest/orchest/services/orchest-controller/pkg/componentregistry"
	"github.com/orchest/orchest/services/orchest-controller/pkg/components/reconcilers"
	"github.com/orchest/orchest/services/orchest-controller/pkg/controller"
	"golang.org/x/net/context"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	netsv1 "k8s.io/api/networking/v1"
	"k8s.io/apimachinery/pkg/runtime"
	appsinformers "k8s.io/client-go/informers/apps/v1"
	coreinformers "k8s.io/client-go/informers/core/v1"
	netsinformers "k8s.io/client-go/informers/networking/v1"
	"k8s.io/client-go/kubernetes"
	appslister "k8s.io/client-go/listers/apps/v1"
	corelister "k8s.io/client-go/listers/core/v1"
	netslister "k8s.io/client-go/listers/networking/v1"
	"k8s.io/client-go/tools/cache"
	"k8s.io/klog/v2"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

type command int

const (
	Update command = iota
	Stop
	Start
	Delete
)

type componentState struct {
	cmd       command
	component *orchestv1alpha1.OrchestComponent
	eventChan chan registry.Event
}

type NativeComponent[Object client.Object] struct {
	*controller.Controller[Object]

	name string

	client kubernetes.Interface

	gClient client.Client

	scheme *runtime.Scheme

	componentsLock sync.RWMutex
	// map of namespaces to the desired state of a component
	componentStates map[string]*componentState

	DepLister appslister.DeploymentLister

	DsLister appslister.DaemonSetLister

	SvcLister corelister.ServiceLister

	IngLister netslister.IngressLister

	reconciler reconcilers.ComponentReconciler
}

func NewNativeComponent[Object client.Object](name string, stopCh <-chan struct{},
	client kubernetes.Interface,
	//gClient client.Client,
	//scheme *runtime.Scheme,
	ctrl *controller.Controller[Object],
	reconciler reconcilers.ComponentReconciler,
	svcInformer coreinformers.ServiceInformer,
	depInformer appsinformers.DeploymentInformer,
	dsInformer appsinformers.DaemonSetInformer,
	ingInformer netsinformers.IngressInformer) registry.Component {

	informerSyncedList := make([]cache.InformerSynced, 0)

	nativeComponent := &NativeComponent[Object]{
		name:            name,
		client:          client,
		componentStates: make(map[string]*componentState),
	}

	// Deployment event handlers
	depWatcher := controller.NewControlleeWatcher[*appsv1.Deployment](ctrl)
	depInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    depWatcher.AddObject,
		UpdateFunc: depWatcher.UpdateObject,
		DeleteFunc: depWatcher.DeleteObject,
	})
	informerSyncedList = append(informerSyncedList, depInformer.Informer().HasSynced)
	nativeComponent.DepLister = depInformer.Lister()

	// Service event handlers
	svcWatcher := controller.NewControlleeWatcher[*corev1.Service](ctrl)
	svcInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    svcWatcher.AddObject,
		UpdateFunc: svcWatcher.UpdateObject,
		DeleteFunc: svcWatcher.DeleteObject,
	})
	informerSyncedList = append(informerSyncedList, svcInformer.Informer().HasSynced)
	nativeComponent.SvcLister = svcInformer.Lister()

	// Daemonset event handlers
	dsWatcher := controller.NewControlleeWatcher[*appsv1.DaemonSet](ctrl)
	dsInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    dsWatcher.AddObject,
		UpdateFunc: dsWatcher.UpdateObject,
		DeleteFunc: dsWatcher.DeleteObject,
	})
	informerSyncedList = append(informerSyncedList, dsInformer.Informer().HasSynced)
	nativeComponent.DsLister = dsInformer.Lister()

	// Ingress event handlers
	ingWatcher := controller.NewControlleeWatcher[*netsv1.Ingress](ctrl)
	ingInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    ingWatcher.AddObject,
		UpdateFunc: ingWatcher.UpdateObject,
		DeleteFunc: ingWatcher.DeleteObject,
	})
	informerSyncedList = append(informerSyncedList, ingInformer.Informer().HasSynced)
	nativeComponent.IngLister = ingInformer.Lister()

	ctrl.InformerSyncedList = informerSyncedList

	ctrl.SyncHandler = nativeComponent.syncHandler

	nativeComponent.Controller = ctrl
	nativeComponent.reconciler = reconciler

	go nativeComponent.Run(stopCh)

	return nativeComponent
}

func (c *NativeComponent[Object]) syncHandler(ctx context.Context, key string) error {

	startTime := time.Now()
	klog.V(3).Infof("Started syncing %s: %s.", c.name, key)
	defer func() {
		klog.V(3).Infof("Finished syncing %s: %s. duration: (%v)", c.name, key, time.Since(startTime))
	}()

	namespace, _, err := cache.SplitMetaNamespaceKey(key)
	if err != nil {
		return err
	}

	c.componentsLock.RLock()
	defer c.componentsLock.RUnlock()
	componentState, ok := c.componentStates[namespace]
	if !ok {
		klog.V(2).Info("Component %s is not registered yet with component controller.", key)
		return nil
	}

	success := false

	defer func() {
		if success {
			componentState.eventChan <- registry.SuccessEvent{}
		}
	}()

	switch componentState.cmd {
	case Update:
		success, err = c.reconciler.Reconcile(ctx, componentState.component)
	case Stop:
		fallthrough
	case Start:
		fallthrough
	case Delete:
		klog.Info("delete")
	}

	return nil
}

func (c *NativeComponent[Object]) Update(ctx context.Context, namespace string,
	message registry.Message, eventChan chan registry.Event) {

	var err error

	// The success is already sent by the inner component, if there is
	defer func() {
		if err != nil {
			eventChan <- registry.ErrorEvent(err.Error())
		}
	}()

	component, ok := message.(*orchestv1alpha1.OrchestComponent)
	if !ok {
		err = fmt.Errorf("Component %s requires message of type *orchestv1alpha1.OrchestComponent", c.name)
		return
	}

	c.componentsLock.Lock()
	defer c.componentsLock.Unlock()
	c.componentStates[namespace] = &componentState{
		cmd:       Update,
		eventChan: eventChan,
		component: component,
	}

	key := namespace + "/" + c.name
	c.EnqueueKey(key)

	klog.Infof("update is called, %s", c.name)

}

func (c *NativeComponent[Object]) Stop(ctx context.Context, namespace string,
	message registry.Message, eventChan chan registry.Event) {
	return
}

func (c *NativeComponent[Object]) Start(ctx context.Context, namespace string,
	message registry.Message, eventChan chan registry.Event) {
	return
}

func (c *NativeComponent[Object]) Delete(ctx context.Context, namespace string,
	message registry.Message, eventChan chan registry.Event) {
}
