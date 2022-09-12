package controller

import (
	"context"
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/util/workqueue"
	"k8s.io/klog/v2"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

var (
	KeyFunc = cache.DeletionHandlingMetaNamespaceKeyFunc
)

type ControleeGetterFunction func(namespace, name string) (interface{}, error)

type SyncHandlerFunction func(ctx context.Context, key string) error

// OrchestClusterController reconciles OrchestCluster CRD.
type Controller[Object client.Object] struct {
	// name of this Controller
	name string

	// the kubernetes client
	kubeClient kubernetes.Interface

	// GroupVersionKind of the object this controller handles
	gvk *schema.GroupVersionKind

	workerLoopPeriod time.Duration

	// queue for the keys that need to be synced.
	queue workqueue.RateLimitingInterface
	// number of workers consuming the queue
	threadiness int

	// sync function
	SyncHandler SyncHandlerFunction

	// The lister of controlee
	ControleeGetter ControleeGetterFunction

	// the list of informerSynced
	InformerSyncedList []cache.InformerSynced
}

func NewController[Object client.Object](name string, threadiness int,
	kubeClient kubernetes.Interface,
	gvk *schema.GroupVersionKind) *Controller[Object] {
	controller := &Controller[Object]{
		name:        name,
		kubeClient:  kubeClient,
		threadiness: threadiness,
		gvk:         gvk,
		queue:       workqueue.NewNamedRateLimitingQueue(workqueue.DefaultControllerRateLimiter(), name),
	}

	return controller
}

// resolveControllerRef returns the controller referenced by a ControllerRef,
// or nil if the ControllerRef could not be resolved to a matching controller
// of the correct Kind.
func (c *Controller[Object]) resolveControllerRef(namespace string, controllerRef *metav1.OwnerReference) interface{} {
	// We can't look up by UID, so look up by Name and then verify UID.
	// Don't even try to look up by Name if it's the wrong Kind.
	if controllerRef.Kind != c.gvk.Kind {
		return nil
	}
	obj, err := c.ControleeGetter(namespace, controllerRef.Name)
	if err != nil {
		return nil
	}

	accessor, err := meta.Accessor(obj)
	if err != nil {
		return nil
	}

	if accessor.GetUID() != controllerRef.UID {
		// The controller we found with this Name is not the same one that the
		// ControllerRef points to.
		return nil
	}
	return obj
}

// Run will not return until stopCh is closed. workers determines how many
// objects will be handled in parallel.
func (c *Controller[Object]) Run(stopCh <-chan struct{}) {

	klog.Infof("Starting %s controller", c.name)
	defer klog.Infof("Shutting down %s controller", c.name)

	defer utilruntime.HandleCrash()
	defer c.queue.ShutDown()

	if !cache.WaitForCacheSync(stopCh, c.InformerSyncedList...) {
		return
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	for i := 0; i < c.threadiness; i++ {
		go wait.UntilWithContext(ctx, c.worker, c.workerLoopPeriod)
	}

	<-stopCh
}

func (c *Controller[Object]) worker(ctx context.Context) {
	for c.processNextWorkItem(ctx) {
	}
}

// processNextWorkItem deals with one key off the queue.  It returns false when it's time to quit.
func (c *Controller[Object]) processNextWorkItem(ctx context.Context) bool {
	eKey, quit := c.queue.Get()
	if quit {
		return false
	}
	defer c.queue.Done(eKey)

	err := c.SyncHandler(ctx, eKey.(string))
	c.handleErr(err, eKey)

	return true
}

func (c *Controller[Object]) Enqueue(obj interface{}) {
	key, err := KeyFunc(obj)
	if err != nil {
		utilruntime.HandleError(fmt.Errorf("Couldn't get key for object %#v: %v", obj, err))
		return
	}

	c.queue.Add(key)
}

func (c *Controller[Object]) EnqueueAfter(obj interface{}) {
	key, err := KeyFunc(obj)
	if err != nil {
		utilruntime.HandleError(fmt.Errorf("Couldn't get key for object %#v: %v", obj, err))
		return
	}

	// TODO: make it configurable
	c.queue.AddAfter(key, time.Second)
}

func (c *Controller[Object]) Client() kubernetes.Interface {
	return c.kubeClient
}

func (c *Controller[Object]) handleErr(err error, key interface{}) {
	if err == nil {
		c.queue.Forget(key)
		return
	}
	klog.Warningf("dropping Object %q out of the queue: %v", key, err)
	c.queue.Forget(key)
	utilruntime.HandleError(err)
}
