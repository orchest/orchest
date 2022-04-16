package orchestcluster

import (
	"context"
	"fmt"
	"path"
	"time"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/client/clientset/versioned"
	orchestinformers "github.com/orchest/orchest/services/orchest-controller/pkg/client/informers/externalversions/orchest/v1alpha1"
	orchestlisters "github.com/orchest/orchest/services/orchest-controller/pkg/client/listers/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/deployer"
	"github.com/orchest/orchest/services/orchest-controller/pkg/helm"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	"github.com/pkg/errors"
	appsv1 "k8s.io/api/apps/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/apimachinery/pkg/util/wait"
	appsinformers "k8s.io/client-go/informers/apps/v1"
	"k8s.io/client-go/kubernetes"
	appslister "k8s.io/client-go/listers/apps/v1"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/tools/record"
	"k8s.io/client-go/util/workqueue"
	"k8s.io/component-base/metrics/prometheus/ratelimiter"
	"k8s.io/klog/v2"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
)

var (
	OrchestClusterKind = "OrchestCluster"
)

type ControllerConfig struct {
	DeployDir                  string
	PostgresDefaultImage       string
	RabbitmqDefaultImage       string
	OrchestDefaultTag          string
	CeleryWorkerImageName      string
	OrchestApiImageName        string
	OrchestWebserverImageName  string
	AuthServerImageName        string
	UserdirDefaultVolumeSize   string
	ConfigdirDefaultVolumeSize string
	BuilddirDefaultVolumeSize  string
	threadiness                int
	InCluster                  bool
}

// OrchestClusterController reconciles OrchestCluster CRD.
type OrchestClusterController struct {
	client kubernetes.Interface

	ocClient versioned.Interface

	config *ControllerConfig

	workerLoopPeriod time.Duration

	queue workqueue.RateLimitingInterface

	deployerManager *deployer.DeployerManager

	eventBroadcaster record.EventBroadcaster

	eventRecorder record.EventRecorder

	ocInformer orchestinformers.OrchestClusterInformer
	ocLister   orchestlisters.OrchestClusterLister
	ocSynced   cache.InformerSynced

	depInformer appsinformers.DaemonSetInformer
	depLister   appslister.DaemonSetLister
	depSynced   cache.InformerSynced
}

// NewOrchestClusterController returns a new *OrchestClusterController.
func NewOrchestClusterController(client kubernetes.Interface,
	ocClient versioned.Interface,
	config *ControllerConfig,
	ocInformer orchestinformers.OrchestClusterInformer,
	depInformer appsinformers.DeploymentInformer) *OrchestClusterController {

	if client != nil && client.CoreV1().RESTClient().GetRateLimiter() != nil {
		ratelimiter.RegisterMetricAndTrackRateLimiterUsage("orchest_cluster_controller", client.CoreV1().RESTClient().GetRateLimiter())
	}

	contoller := OrchestClusterController{
		client:           client,
		ocClient:         ocClient,
		config:           config,
		workerLoopPeriod: time.Second,
		queue:            workqueue.NewNamedRateLimitingQueue(workqueue.DefaultControllerRateLimiter(), "orchest cluster"),
	}

	ocInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: contoller.onOrchestClusterUpdate,
		UpdateFunc: func(old, cur interface{}) {
			contoller.onOrchestClusterUpdate(cur)
		},
		DeleteFunc: contoller.onOrchestClusterUpdate,
	})

	contoller.ocInformer = ocInformer
	contoller.ocLister = ocInformer.Lister()
	contoller.ocSynced = ocInformer.Informer().HasSynced

	depInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: contoller.onDeploymentUpdate,
		UpdateFunc: func(old, cur interface{}) {
			contoller.onDeploymentUpdate(cur)
		},
		DeleteFunc: contoller.onDeploymentUpdate,
	})

	contoller.depInformer = depInformer
	contoller.depLister = depInformer.Lister()
	contoller.depSynced = depInformer.Informer().HasSynced

	return &contoller
}

func (r *OrchestClusterController) intiDeployerManager() {
	r.deployerManager = deployer.NewDeployerManager()

	r.deployerManager.AddDeployer(helm.NewHelmDeployer("argo", path.Join(r.config.DeployDir, "thirdparty/argo-workflows")))
	r.deployerManager.AddDeployer(helm.NewHelmDeployer("registry", path.Join(r.config.DeployDir, "thirdparty/docker-registry")))

}

func (contoller *OrchestClusterController) onDeploymentUpdate(obj interface{}) {
	dep, ok := obj.(*appsv1.Deployment)
	if !ok {
		tombstone, ok := obj.(cache.DeletedFinalStateUnknown)
		if !ok {
			utilruntime.HandleError(fmt.Errorf("couldn't get object from tombstone %#v", obj))
			return
		}
		dep, ok = tombstone.Obj.(*appsv1.Deployment)
		if !ok {
			utilruntime.HandleError(fmt.Errorf("tombstone contained object that is not a Deployment %#v", obj))
			return
		}
	}

	if dep.ObjectMeta.OwnerReferences != nil && dep.ObjectMeta.OwnerReferences[0].Kind == OrchestClusterKind {
		orchest, err := contoller.ocLister.OrchestClusters(dep.Namespace).Get(dep.ObjectMeta.OwnerReferences[0].Name)
		if err != nil {
			utilruntime.HandleError(fmt.Errorf("couldn't get OrchestCluster=%s in namespace=%s",
				dep.ObjectMeta.OwnerReferences[0].Name,
				dep.Namespace))
			return
		}

		key, err := cache.MetaNamespaceKeyFunc(orchest)
		if err != nil {
			utilruntime.HandleError(fmt.Errorf("couldn't get key for object %+v: %v", obj, err))
			return
		}
		klog.V(3).Infof("DaemonSet update update: %s", orchest.Name)
		contoller.queue.AddRateLimited(key)
	}
}

func (contoller *OrchestClusterController) onOrchestClusterUpdate(obj interface{}) {
	orchest, ok := obj.(*orchestv1alpha1.OrchestCluster)
	if !ok {
		tombstone, ok := obj.(cache.DeletedFinalStateUnknown)
		if !ok {
			utilruntime.HandleError(fmt.Errorf("couldn't get object from tombstone %#v", obj))
			return
		}
		_, ok = tombstone.Obj.(*orchestv1alpha1.OrchestCluster)
		if !ok {
			utilruntime.HandleError(fmt.Errorf("tombstone contained object that is not a OrchestCluster %#v", obj))
			return
		}
	}

	key, err := cache.MetaNamespaceKeyFunc(orchest)
	if err != nil {
		utilruntime.HandleError(fmt.Errorf("couldn't get key for OrchestCluster %+v: %v", obj, err))
		return
	}
	klog.V(3).Infof("OrchestCluster update event :%s", orchest.Name)
	contoller.queue.AddRateLimited(key)
}

// Run will not return until stopCh is closed. workers determines how many
// endpoints will be handled in parallel.
func (contoller *OrchestClusterController) Run(stopCh <-chan struct{}) {

	klog.Infof("Starting orchest cluster controller")
	defer klog.Infof("Shutting down orchest cluster controller")

	defer utilruntime.HandleCrash()
	defer contoller.queue.ShutDown()

	if !cache.WaitForCacheSync(stopCh, contoller.ocSynced, contoller.depSynced) {
		return
	}

	for i := 0; i < contoller.config.threadiness; i++ {
		go wait.Until(contoller.worker, contoller.workerLoopPeriod, stopCh)
	}

	<-stopCh
}

func (contoller *OrchestClusterController) worker() {
	for contoller.processNextWorkItem() {
	}
}

func (contoller *OrchestClusterController) processNextWorkItem() bool {
	eKey, quit := contoller.queue.Get()
	if quit {
		return false
	}
	defer contoller.queue.Done(eKey)

	err := contoller.syncOrchestCluster(eKey.(string))
	contoller.handleErr(err, eKey)

	return true
}

func (contoller *OrchestClusterController) handleErr(err error, key interface{}) {
	if err == nil {
		contoller.queue.Forget(key)
		return
	}
	klog.Warningf("dropping orchest csluter %q out of the queue: %v", key, err)
	contoller.queue.Forget(key)
	utilruntime.HandleError(err)
}

func (contoller *OrchestClusterController) syncOrchestCluster(key string) error {

	// Get OrchestCluster CRD from kubernetes
	cluster := &orchestv1alpha1.OrchestCluster{}
	err := r.client.Get(ctx, req.NamespacedName, cluster)
	if err != nil {
		if kerrors.IsNotFound(err) {
			klog.V(2).Info("OrchestCluster %s resource not found.", req.NamespacedName)
			return reconcile.Result{}, nil
		}
		// Error reading OrchestCluster - The request will be requeued.
		return reconcile.Result{}, errors.Wrap(err, "failed to get OrchestCluster")
	}

	// Set a finalizer so we can do cleanup before the object goes away
	err = utils.AddFinalizerIfNotPresent(ctx, r.client, cluster, orchestv1alpha1.Finalizer)
	if err != nil {
		return reconcile.Result{}, errors.Wrap(err, "failed to add finalizer")
	}

	if !cluster.GetDeletionTimestamp().IsZero() {
		// The cluster is deleted, delete it
		return r.deleteOrchestCluster(ctx, req)
	}

	// Reconciling
	if err := r.reconcileCluster(ctx, cluster); err != nil {
		return reconcile.Result{}, errors.Wrapf(err, "failed to reconcile cluster %q", req.NamespacedName)
	}

	// Return and do not requeue
	return reconcile.Result{}, nil
}

func (r *OrchestClusterController) deleteOrchestCluster(ctx context.Context,
	req ctrl.Request) (reconcile.Result, error) {

	cluster := &orchestv1alpha1.OrchestCluster{}
	if err := r.client.Get(ctx, req.NamespacedName, cluster); err != nil {
		return reconcile.Result{}, errors.Wrapf(err, "failed to get cluster %v during deleting cluster.", req.NamespacedName)
	}

	// Update Cluster status
	err := r.updateClusterStatus(ctx, cluster, orchestv1alpha1.Deleting, "Deleting the Cluster")
	if err != nil {
		return reconcile.Result{}, errors.Wrap(err, "failed to update cluster status finalizers")
	}
	// Remove finalizers
	err = utils.RemoveFinalizerIfNotPresent(ctx, r.client, cluster, orchestv1alpha1.Finalizer)
	if err != nil {
		return reconcile.Result{}, errors.Wrap(err, "failed to remove finalizers")
	}

	return reconcile.Result{}, nil
}

func (r *OrchestClusterController) reconcileCluster(ctx context.Context, cluster *orchestv1alpha1.OrchestCluster) error {

	// If Status struct is not initialized yet, the cluster is new, create it
	if cluster.Status == nil {
		// Set the default values in CR if not specified
		copy := r.getClusterWithIfNotSpecified(ctx, cluster)
		err := r.updateClusterStatus(ctx, copy, orchestv1alpha1.Initializing, "Initializing Orchest Cluster")
		if err != nil {
			klog.Error(err)
			return err
		}
		return nil
	}

	switch cluster.Status.State {
	case orchestv1alpha1.Initializing:
		// First step is to deploy Argo
		err := r.updateClusterStatus(ctx, cluster, orchestv1alpha1.DeployingArgo, "Deploying Argo")
		if err != nil {
			klog.Error(err)
			return err
		}
	case orchestv1alpha1.DeployingArgo:
		err := r.deployerManager.Get("argo").InstallIfChanged(ctx, cluster.Namespace, nil)
		if err != nil {
			klog.Error(err)
			return err
		}

		err = r.updateClusterStatus(ctx, cluster, orchestv1alpha1.DeployingRegistry, "Deploying Registry")
		if err != nil {
			klog.Error(err)
			return err
		}
	case orchestv1alpha1.DeployingRegistry:
		err := r.deployerManager.Get("registry").InstallIfChanged(ctx, cluster.Namespace, nil)
		if err != nil {
			klog.Error(err)
			return err
		}

		err = r.updateClusterStatus(ctx, cluster, orchestv1alpha1.DeployingOrchest, "Deploying Orchest control plane")
		if err != nil {
			klog.Error(err)
			return err
		}
	case orchestv1alpha1.DeployingOrchest:
		err := r.deployerManager.Get("orchest").InstallIfChanged(ctx, cluster.Namespace, cluster)
		if err != nil {
			klog.Error(err)
			return err
		}

		err = r.updateClusterStatus(ctx, cluster, orchestv1alpha1.DeployingOrchest, "Deploying Orchest control plane")
		if err != nil {
			klog.Error(err)
			return err
		}

	}

	return nil

}

func (r *OrchestClusterController) updateClusterStatus(ctx context.Context, cluster *orchestv1alpha1.OrchestCluster,
	state orchestv1alpha1.OrchestClusterState, message string) error {

	cluster.Status = &orchestv1alpha1.OrchestClusterStatus{
		State:   state,
		Message: message,
	}

	err := r.client.Status().Update(ctx, cluster)
	// If the object doesn't exist yet, it has to be initialized
	if kerrors.IsNotFound(err) {
		err = r.client.Update(ctx, cluster)
	}
	if err != nil {
		return errors.Wrapf(err, "failed to update orchest with status  %q", cluster.Name)
	}
	return nil
}

func (r *OrchestClusterController) getClusterWithIfNotSpecified(ctx context.Context,
	cluster *orchestv1alpha1.OrchestCluster) *orchestv1alpha1.OrchestCluster {

	copy := cluster.DeepCopy()

	changed := false

	if copy.Spec.Orchest.DefaultTag == "" {
		changed = true
		copy.Spec.Orchest.DefaultTag = r.config.OrchestDefaultTag
	}

	if copy.Spec.Postgres.Image == "" {
		changed = true
		copy.Spec.Postgres.Image = r.config.PostgresDefaultImage
	}

	if copy.Spec.RabbitMq.Image == "" {
		changed = true
		copy.Spec.RabbitMq.Image = r.config.RabbitmqDefaultImage
	}

	if copy.Spec.Orchest.Resources.UserDirVolumeSize == "" {
		changed = true
		copy.Spec.Orchest.Resources.UserDirVolumeSize = r.config.UserdirDefaultVolumeSize
	}

	if copy.Spec.Orchest.Resources.BuilderCacheDirVolumeSize == "" {
		changed = true
		copy.Spec.Orchest.Resources.BuilderCacheDirVolumeSize = r.config.BuilddirDefaultVolumeSize
	}

	if copy.Spec.Orchest.Resources.ConfigDirVolumeSize == "" {
		changed = true
		copy.Spec.Orchest.Resources.ConfigDirVolumeSize = r.config.ConfigdirDefaultVolumeSize
	}

	if changed {
		return copy
	}
	return cluster
}
