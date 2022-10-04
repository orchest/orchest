package components

import (
	"fmt"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	registry "github.com/orchest/orchest/services/orchest-controller/pkg/componentregistry"
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

type NativeComponent[Object client.Object] struct {
	*controller.Controller[Object]

	name string

	client kubernetes.Interface

	gClient client.Client

	scheme *runtime.Scheme

	depLister appslister.DeploymentLister

	dsLister appslister.DaemonSetLister

	svcLister corelister.ServiceLister

	ingLister netslister.IngressLister
}

func NewNativeComponent[Object client.Object](name string, stopCh <-chan struct{},
	client kubernetes.Interface,
	//gClient client.Client,
	//scheme *runtime.Scheme,
	svcInformer coreinformers.ServiceInformer,
	depInformer appsinformers.DeploymentInformer,
	dsInformer appsinformers.DaemonSetInformer,
	ingInformer netsinformers.IngressInformer) registry.Component {

	informerSyncedList := make([]cache.InformerSynced, 0)

	ctrl := controller.NewController[Object](
		fmt.Sprintf("Native component for %s", name),
		1,
		client,
		nil,
	)

	nativeComponent := &NativeComponent[Object]{
		name:   name,
		client: client,
	}

	// Deployment event handlers
	depWatcher := controller.NewControlleeWatcher[*appsv1.Deployment](ctrl)
	depInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    depWatcher.AddObject,
		UpdateFunc: depWatcher.UpdateObject,
		DeleteFunc: depWatcher.DeleteObject,
	})
	informerSyncedList = append(informerSyncedList, depInformer.Informer().HasSynced)
	nativeComponent.depLister = depInformer.Lister()

	// Service event handlers
	svcWatcher := controller.NewControlleeWatcher[*corev1.Service](ctrl)
	svcInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    svcWatcher.AddObject,
		UpdateFunc: svcWatcher.UpdateObject,
		DeleteFunc: svcWatcher.DeleteObject,
	})
	informerSyncedList = append(informerSyncedList, svcInformer.Informer().HasSynced)
	nativeComponent.svcLister = svcInformer.Lister()

	// Daemonset event handlers
	dsWatcher := controller.NewControlleeWatcher[*appsv1.DaemonSet](ctrl)
	dsInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    dsWatcher.AddObject,
		UpdateFunc: dsWatcher.UpdateObject,
		DeleteFunc: dsWatcher.DeleteObject,
	})
	informerSyncedList = append(informerSyncedList, dsInformer.Informer().HasSynced)
	nativeComponent.dsLister = dsInformer.Lister()

	// Ingress event handlers
	ingWatcher := controller.NewControlleeWatcher[*netsv1.Ingress](ctrl)
	ingInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    ingWatcher.AddObject,
		UpdateFunc: ingWatcher.UpdateObject,
		DeleteFunc: ingWatcher.DeleteObject,
	})
	informerSyncedList = append(informerSyncedList, ingInformer.Informer().HasSynced)
	nativeComponent.ingLister = ingInformer.Lister()

	ctrl.InformerSyncedList = informerSyncedList

	ctrl.SyncHandler = nativeComponent.syncHandler

	nativeComponent.Controller = ctrl

	go nativeComponent.Run(stopCh)

	return nativeComponent
}

func (component *NativeComponent[Object]) syncHandler(ctx context.Context, key string) error {

	klog.Infof("ffffffffffff %s name= %s", key, component.name)
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

	component, ok := message.(*orchestv1alpha1.OrchestComponentTemplate)
	if !ok {
		err = fmt.Errorf("Component %s requires message of type *orchestv1alpha1.OrchestComponentTemplate", c.name)
		return
	}

	component.Env = nil

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
