package orchestcomponent

import (
	"fmt"
	"time"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/client/clientset/versioned"
	orchestinformers "github.com/orchest/orchest/services/orchest-controller/pkg/client/informers/externalversions/orchest/v1alpha1"
	orchestlisters "github.com/orchest/orchest/services/orchest-controller/pkg/client/listers/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/controller"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	netsv1 "k8s.io/api/networking/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
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

var (
	OrchestComponentKind = orchestv1alpha1.SchemeGroupVersion.WithKind("OrchestComponent")
)

type OrchestComponentReconciler interface {
	Reconcile(context.Context, *orchestv1alpha1.OrchestComponent) error

	Uninstall(context.Context, *orchestv1alpha1.OrchestComponent) (bool, error)
}

// OrchestComponentController reconciles OrchestComponent CRD.
type OrchestComponentController struct {
	*controller.Controller[*orchestv1alpha1.OrchestComponent]

	oClient versioned.Interface

	gClient client.Client

	scheme *runtime.Scheme

	depLister appslister.DeploymentLister

	dsLister appslister.DaemonSetLister

	svcLister corelister.ServiceLister

	ingLister netslister.IngressLister

	oComponentLister orchestlisters.OrchestComponentLister

	reconcilers map[string]OrchestComponentReconciler
}

// NewOrchestComponentController returns a new *NewOrchestComponentController.
func NewOrchestComponentController(kClient kubernetes.Interface,
	oClient versioned.Interface,
	gClient client.Client,
	scheme *runtime.Scheme,
	oComponentInformer orchestinformers.OrchestComponentInformer,
	svcInformer coreinformers.ServiceInformer,
	depInformer appsinformers.DeploymentInformer,
	dsInformer appsinformers.DaemonSetInformer,
	ingInformer netsinformers.IngressInformer,

) *OrchestComponentController {

	informerSyncedList := make([]cache.InformerSynced, 0, 0)

	ctrl := controller.NewController[*orchestv1alpha1.OrchestComponent](
		"orchest-component",
		1,
		kClient,
		&OrchestComponentKind,
	)

	occ := OrchestComponentController{
		oClient:     oClient,
		gClient:     gClient,
		scheme:      scheme,
		reconcilers: make(map[string]OrchestComponentReconciler),
	}

	// OrchestComponent event handlers
	oComponentInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    occ.addOrchestComponent,
		UpdateFunc: occ.updateOrchestComponent,
		DeleteFunc: occ.deleteOrchestComponent,
	})
	informerSyncedList = append(informerSyncedList, oComponentInformer.Informer().HasSynced)
	occ.oComponentLister = oComponentInformer.Lister()

	// Service event handlers
	svcWatcher := controller.NewControlleeWatcher[*corev1.Service](ctrl)
	svcInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    svcWatcher.AddObject,
		UpdateFunc: svcWatcher.UpdateObject,
		DeleteFunc: svcWatcher.DeleteObject,
	})
	informerSyncedList = append(informerSyncedList, svcInformer.Informer().HasSynced)
	occ.svcLister = svcInformer.Lister()

	// Deployment event handlers
	depWatcher := controller.NewControlleeWatcher[*appsv1.Deployment](ctrl)
	depInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    depWatcher.AddObject,
		UpdateFunc: depWatcher.UpdateObject,
		DeleteFunc: depWatcher.DeleteObject,
	})
	informerSyncedList = append(informerSyncedList, depInformer.Informer().HasSynced)
	occ.depLister = depInformer.Lister()

	// Daemonset event handlers
	dsWatcher := controller.NewControlleeWatcher[*appsv1.DaemonSet, *orchestv1alpha1.OrchestComponent](ctrl)
	dsInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    dsWatcher.AddObject,
		UpdateFunc: dsWatcher.UpdateObject,
		DeleteFunc: dsWatcher.DeleteObject,
	})
	informerSyncedList = append(informerSyncedList, dsInformer.Informer().HasSynced)
	occ.dsLister = dsInformer.Lister()

	// Ingress event handlers
	ingWatcher := controller.NewControlleeWatcher[*netsv1.Ingress, *orchestv1alpha1.OrchestComponent](ctrl)
	ingInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    ingWatcher.AddObject,
		UpdateFunc: ingWatcher.UpdateObject,
		DeleteFunc: ingWatcher.DeleteObject,
	})
	informerSyncedList = append(informerSyncedList, ingInformer.Informer().HasSynced)
	occ.ingLister = ingInformer.Lister()

	ctrl.InformerSyncedList = informerSyncedList
	ctrl.SyncHandler = occ.syncOrchestComponent
	ctrl.ControleeGetter = occ.getOrchestComponent

	occ.Controller = ctrl

	// Init reconcilers
	occ.reconcilers[controller.OrchestDatabase] = NewOrchestDatabaseReconciler(&occ)
	occ.reconcilers[controller.OrchestApi] = NewOrchestApiReconciler(&occ)
	occ.reconcilers[controller.Rabbitmq] = NewRabbitmqServerReconciler(&occ)
	occ.reconcilers[controller.CeleryWorker] = NewCeleryWorkerReconciler(&occ)
	occ.reconcilers[controller.AuthServer] = NewAuthServerReconciler(&occ)
	occ.reconcilers[controller.OrchestWebserver] = NewOrchestWebServerReconciler(&occ)
	occ.reconcilers[controller.NodeAgent] = NewNodeAgentReconciler(&occ)
	occ.reconcilers[controller.BuildKitDaemon] = NewBuildKitDaemonReconciler(&occ)

	return &occ
}

func (occ *OrchestComponentController) addOrchestComponent(obj interface{}) {
	oc := obj.(*orchestv1alpha1.OrchestComponent)
	klog.V(4).Infof("Adding OrchestComponent %s", oc.Name)
	occ.Enqueue(oc)
}

func (occ *OrchestComponentController) updateOrchestComponent(cur, old interface{}) {
	oldOc := old.(*orchestv1alpha1.OrchestComponent)
	curOc := cur.(*orchestv1alpha1.OrchestComponent)

	if curOc.UID != oldOc.UID {
		key, err := controller.KeyFunc(oldOc)
		if err != nil {
			utilruntime.HandleError(fmt.Errorf("couldn't get key for object %#v: %v", oldOc, err))
			return
		}
		occ.deleteOrchestComponent(cache.DeletedFinalStateUnknown{
			Key: key,
			Obj: oldOc,
		})
	}

	klog.V(4).Infof("Updating OrchestComponent %s", oldOc.Name)
	occ.Enqueue(curOc)
}

func (occ *OrchestComponentController) deleteOrchestComponent(obj interface{}) {
	oc, ok := obj.(*orchestv1alpha1.OrchestComponent)
	if !ok {
		tombstone, ok := obj.(cache.DeletedFinalStateUnknown)
		if !ok {
			utilruntime.HandleError(fmt.Errorf("couldn't get object from tombstone %#v", obj))
			return
		}
		oc, ok = tombstone.Obj.(*orchestv1alpha1.OrchestComponent)
		if !ok {
			utilruntime.HandleError(fmt.Errorf("tombstone contained object that is not a OrchestComponent %#v", obj))
			return
		}
	}
	klog.V(4).Infof("Deleting OrchestComponent %s", oc.Name)

	occ.Enqueue(oc)
}

func (occ *OrchestComponentController) getOrchestComponent(namespace, name string) (
	interface{}, error) {
	return occ.oComponentLister.OrchestComponents(namespace).Get(name)
}

func (occ *OrchestComponentController) syncOrchestComponent(ctx context.Context, key string) error {

	startTime := time.Now()
	klog.V(3).Infof("Started syncing OrchestComponent: %s.", key)
	defer func() {
		klog.V(3).Infof("Finished syncing OrchestComponent: %s. duration: (%v)", key, time.Since(startTime))
	}()

	namespace, name, err := cache.SplitMetaNamespaceKey(key)
	if err != nil {
		return err
	}

	component, err := occ.oComponentLister.OrchestComponents(namespace).Get(name)
	if err != nil {
		if kerrors.IsNotFound(err) {
			klog.V(2).Info("OrchestCluster %s resource not found.", key)
			return nil
		}
		// Error reading OrchestCluster - The request will be requeued.
		return errors.Wrapf(err, "failed to get to OrchestCluster %s", key)
	}

	if !component.GetDeletionTimestamp().IsZero() {
		// The cluster is deleted, delete it
		success, err := occ.uninstallOrchestComponent(ctx, component)
		if err != nil {
			return err
		}

		if success {
			_, err = controller.RemoveFinalizerIfPresent(ctx, occ.gClient, component, orchestv1alpha1.Finalizer)
			return err
		}

		return err
	}

	// Set a finalizer so we can do cleanup before the object goes away
	changed, err := controller.AddFinalizerIfNotPresent(ctx, occ.gClient, component, orchestv1alpha1.Finalizer)
	if changed || err != nil {
		return err
	}

	return occ.manageOrchestComponent(ctx, component)
}

// Installs deployer if the config is changed
func (occ *OrchestComponentController) manageOrchestComponent(ctx context.Context,
	component *orchestv1alpha1.OrchestComponent) (err error) {

	reconciler, ok := occ.reconcilers[component.Name]
	if !ok {
		return errors.Errorf("unrecognized component reconciler name : %s", component.Name)
	}

	return reconciler.Reconcile(ctx, component)
}

// Uninstall
func (occ *OrchestComponentController) uninstallOrchestComponent(ctx context.Context,
	component *orchestv1alpha1.OrchestComponent) (bool, error) {

	reconciler, ok := occ.reconcilers[component.Name]
	if !ok {
		return false, errors.Errorf("unrecognized component reconciler name : %s", component.Name)
	}

	return reconciler.Uninstall(ctx, component)
}

func (occ *OrchestComponentController) updatePhase(ctx context.Context,
	component *orchestv1alpha1.OrchestComponent,
	phase orchestv1alpha1.OrchestPhase) error {

	if component.Status != nil && component.Status.Phase == phase {
		return nil
	} else if component.Status != nil {
		component.Status.Phase = phase
		component.Status.LastHeartbeatTime = metav1.NewTime(time.Now())
	} else {
		component.Status = &orchestv1alpha1.OrchestComponentStatus{
			Phase:             phase,
			LastHeartbeatTime: metav1.NewTime(time.Now()),
		}
	}

	_, err := occ.oClient.OrchestV1alpha1().OrchestComponents(component.Namespace).UpdateStatus(ctx, component, metav1.UpdateOptions{})
	if err != nil {
		return errors.Wrapf(err, "failed to update orchest with phase %q", component.Status.Phase)
	}

	return nil
}
