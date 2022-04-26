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
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	"github.com/pkg/errors"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
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
	"sigs.k8s.io/controller-runtime/pkg/client"
)

var (
	OrchestClusterKind             = "OrchestCluster"
	OrchestClusterVersion          = "orchest.io/v1alpha1"
	ControllerRevisionHashLabelKey = "controller-revision-hash"
	RestartAnnotationKey           = "orchest.io/restart"
	PauseReasonAnnotationKey       = "orchest.io/pause-reason"

	PauseReasonOrchestUpdated    = "Orchest Updated"
	PauseReasonRestartAnnotation = "Restart Annotation"
	PauseReasonOrchestPaused     = "Restart OrchestPaused"

	True  = true
	False = false
)

type ControllerConfig struct {
	DeployDir                  string
	PostgresDefaultImage       string
	RabbitmqDefaultImage       string
	OrchestDefaultVersion      string
	CeleryWorkerImageName      string
	OrchestApiImageName        string
	OrchestWebserverImageName  string
	AuthServerImageName        string
	UserdirDefaultVolumeSize   string
	ConfigdirDefaultVolumeSize string
	BuilddirDefaultVolumeSize  string
	Threadiness                int
	InCluster                  bool
	DefaultPause               bool
}

// OrchestClusterController reconciles OrchestCluster CRD.
type OrchestClusterController struct {
	kClient kubernetes.Interface

	oClient versioned.Interface

	gClient client.Client

	scheme *runtime.Scheme

	config ControllerConfig

	workerLoopPeriod time.Duration

	queue workqueue.RateLimitingInterface

	deployerManager *deployer.DeployerManager

	eventBroadcaster record.EventBroadcaster

	eventRecorder record.EventRecorder

	ocInformer orchestinformers.OrchestClusterInformer
	ocLister   orchestlisters.OrchestClusterLister
	ocSynced   cache.InformerSynced

	depInformer appsinformers.DeploymentInformer
	depLister   appslister.DeploymentLister
	depSynced   cache.InformerSynced

	reconcilers map[string]*OrchestReconciler
}

// NewOrchestClusterController returns a new *OrchestClusterController.
func NewOrchestClusterController(kClient kubernetes.Interface,
	oClient versioned.Interface,
	gClient client.Client,
	scheme *runtime.Scheme,
	config ControllerConfig,
	ocInformer orchestinformers.OrchestClusterInformer,
	depInformer appsinformers.DeploymentInformer) *OrchestClusterController {

	if kClient != nil && kClient.CoreV1().RESTClient().GetRateLimiter() != nil {
		ratelimiter.RegisterMetricAndTrackRateLimiterUsage("orchest_cluster_controller", kClient.CoreV1().RESTClient().GetRateLimiter())
	}

	controller := OrchestClusterController{
		kClient:          kClient,
		oClient:          oClient,
		gClient:          gClient,
		scheme:           scheme,
		config:           config,
		workerLoopPeriod: time.Second,
		reconcilers:      make(map[string]*OrchestReconciler),
		queue:            workqueue.NewNamedRateLimitingQueue(workqueue.DefaultControllerRateLimiter(), "orchest cluster"),
	}

	ocInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: controller.onOrchestClusterUpdate,
		UpdateFunc: func(old, cur interface{}) {
			controller.onOrchestClusterUpdate(cur)
		},
		DeleteFunc: controller.onOrchestClusterUpdate,
	})

	controller.ocInformer = ocInformer
	controller.ocLister = ocInformer.Lister()
	controller.ocSynced = ocInformer.Informer().HasSynced

	depInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: controller.onDeploymentUpdate,
		UpdateFunc: func(old, cur interface{}) {
			controller.onDeploymentUpdate(cur)
		},
		DeleteFunc: controller.onDeploymentUpdate,
	})

	controller.depInformer = depInformer
	controller.depLister = depInformer.Lister()
	controller.depSynced = depInformer.Informer().HasSynced

	controller.intiDeployerManager()

	return &controller
}

func (r *OrchestClusterController) intiDeployerManager() {
	r.deployerManager = deployer.NewDeployerManager()

	r.deployerManager.AddDeployer("argo",
		deployer.NewHelmDeployer("argo", path.Join(r.config.DeployDir, "thirdparty/argo-workflows")))
	r.deployerManager.AddDeployer("registry",
		deployer.NewHelmDeployer("nginx-ingress", path.Join(r.config.DeployDir, "thirdparty/nginx-ingress")))
	r.deployerManager.AddDeployer("registry",
		deployer.NewHelmDeployer("registry", path.Join(r.config.DeployDir, "thirdparty/docker-registry")))
	r.deployerManager.AddDeployer("cert-manager",
		deployer.NewPathDeployer("cert-manager", path.Join(r.config.DeployDir, "thirdparty/cert-manager"),
			r.gClient, r.scheme))

}

func (controller *OrchestClusterController) onDeploymentUpdate(obj interface{}) {
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
		orchest, err := controller.ocLister.OrchestClusters(dep.Namespace).Get(dep.ObjectMeta.OwnerReferences[0].Name)
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
		klog.V(3).Infof("Deployment update update: %s", orchest.Name)
		controller.queue.AddRateLimited(key)
	}
}

func (controller *OrchestClusterController) onOrchestClusterUpdate(obj interface{}) {
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
	controller.queue.AddRateLimited(key)
}

// Run will not return until stopCh is closed. workers determines how many
// endpoints will be handled in parallel.
func (controller *OrchestClusterController) Run(stopCh <-chan struct{}) {

	klog.Infof("Starting orchest cluster controller")
	defer klog.Infof("Shutting down orchest cluster controller")

	defer utilruntime.HandleCrash()
	defer controller.queue.ShutDown()

	if !cache.WaitForCacheSync(stopCh, controller.ocSynced, controller.depSynced) {
		return
	}

	for i := 0; i < controller.config.Threadiness; i++ {
		go wait.Until(controller.worker, controller.workerLoopPeriod, stopCh)
	}

	<-stopCh
}

func (controller *OrchestClusterController) worker() {
	for controller.processNextWorkItem() {
	}
}

func (controller *OrchestClusterController) processNextWorkItem() bool {
	eKey, quit := controller.queue.Get()
	if quit {
		return false
	}
	defer controller.queue.Done(eKey)

	err := controller.syncOrchestCluster(eKey.(string))
	controller.handleErr(err, eKey)

	return true
}

func (controller *OrchestClusterController) handleErr(err error, key interface{}) {
	if err == nil {
		controller.queue.Forget(key)
		return
	}
	klog.Warningf("dropping orchest csluter %q out of the queue: %v", key, err)
	controller.queue.Forget(key)
	utilruntime.HandleError(err)
}

func (controller *OrchestClusterController) syncOrchestCluster(key string) error {

	startTime := time.Now()
	klog.V(3).Infof("Started syncing OrchestCluster: %s.", key)
	defer func() {
		klog.V(3).Infof("Finished syncing DDSet OrchestCluster: %s. duration: (%v)", key, time.Since(startTime))
	}()

	ctx, cancel := context.WithCancel(context.Background())
	defer func() {
		cancel()
	}()

	namespace, name, err := cache.SplitMetaNamespaceKey(key)
	if err != nil {
		return err
	}

	orchest, err := controller.ocLister.OrchestClusters(namespace).Get(name)
	if err != nil {
		if kerrors.IsNotFound(err) {
			klog.V(2).Info("OrchestCluster %s resource not found.", key)
			return nil
		}
		// Error reading OrchestCluster - The request will be requeued.
		return errors.Wrap(err, "failed to get OrchestCluster")
	}

	// Set a finalizer so we can do cleanup before the object goes away
	orchest, err = AddFinalizerIfNotPresent(ctx, controller.oClient, orchest, orchestv1alpha1.Finalizer)
	if err != nil {
		errors.Wrap(err, "failed to add finalizer")
	}

	if !orchest.GetDeletionTimestamp().IsZero() {
		// The cluster is deleted, delete it
		return controller.deleteOrchestCluster(ctx, name, namespace)
	}

	// Reconciling
	// If Status struct is not initialized yet, the cluster is new, create it
	if orchest.Status == nil {
		// Set the default values in CR if not specified
		err = controller.updateClusterCondition(ctx, orchest,
			orchestv1alpha1.Initializing, corev1.ConditionTrue, "Initializing Orchest Cluster")
		if err != nil {
			klog.Error(err)
			return err
		}
		return nil
	}

	orchest, err = controller.setDefaultIfNotSpecified(ctx, orchest)
	if err != nil {
		return err
	}

	err = controller.ensureThirdPartyDependencies(ctx, orchest)
	if err != nil {
		return err
	}

	if err := controller.reconcileCluster(ctx, key); err != nil {
		return errors.Wrapf(err, "failed to reconcile OrchestCluster %q", name)
	}

	// Return and do not requeue
	return nil
}

func (controller *OrchestClusterController) deleteOrchestCluster(ctx context.Context,
	name, namespace string) error {

	orchest, err := controller.ocLister.OrchestClusters(namespace).Get(name)
	if err != nil {
		if kerrors.IsNotFound(err) {
			klog.V(2).Info("OrchestCluster %s resource not found.", name)
			return nil
		}
		return errors.Wrapf(err, "failed to get cluster %v during deleting cluster.", name)
	}

	// Update Cluster status
	err = controller.updateClusterCondition(ctx, orchest,
		orchestv1alpha1.Deleting, corev1.ConditionTrue, "")
	if err != nil {
		return errors.Wrapf(err, "failed to update cluster status to orchestv1alpha1.Deleting, OrchestCluster: %s",
			name)
	}

	// Remove finalizers
	err = RemoveFinalizerIfNotPresent(ctx, controller.oClient, orchest, orchestv1alpha1.Finalizer)
	if err != nil {
		return errors.Wrap(err, "failed to remove finalizers")
	}

	// Delete the reconciler from the internal map
	key := namespace + "/" + name
	delete(controller.reconcilers, key)

	return nil
}

func (controller *OrchestClusterController) reconcileCluster(ctx context.Context, key string) error {

	reconciler, ok := controller.reconcilers[key]
	// This is a new cluster known to us, we should create a new reconciler for it
	if !ok {
		reconciler = NewOrchestReconciler(key, controller)
		controller.reconcilers[key] = reconciler
	}

	reconciler.Reconcile(ctx)

	return nil
}

func (controller *OrchestClusterController) setDefaultIfNotSpecified(ctx context.Context,
	orchest *orchestv1alpha1.OrchestCluster) (*orchestv1alpha1.OrchestCluster, error) {

	copy := orchest.DeepCopy()

	changed := false

	if copy.Spec.Orchest.Version == "" {
		changed = true
		copy.Spec.Orchest.Version = controller.config.OrchestDefaultVersion
	}

	if copy.Spec.Orchest.Pause == nil {
		changed = true
		copy.Spec.Orchest.Pause = &controller.config.DefaultPause
	}

	if copy.Spec.Postgres.Image == "" {
		changed = true
		copy.Spec.Postgres.Image = controller.config.PostgresDefaultImage
	}

	if copy.Spec.RabbitMq.Image == "" {
		changed = true
		copy.Spec.RabbitMq.Image = controller.config.RabbitmqDefaultImage
	}

	if copy.Spec.Orchest.Resources.UserDirVolumeSize == "" {
		changed = true
		copy.Spec.Orchest.Resources.UserDirVolumeSize = controller.config.UserdirDefaultVolumeSize
	}

	if copy.Spec.Orchest.Resources.BuilderCacheDirVolumeSize == "" {
		changed = true
		copy.Spec.Orchest.Resources.BuilderCacheDirVolumeSize = controller.config.BuilddirDefaultVolumeSize
	}

	if copy.Spec.Orchest.Resources.ConfigDirVolumeSize == "" {
		changed = true
		copy.Spec.Orchest.Resources.ConfigDirVolumeSize = controller.config.ConfigdirDefaultVolumeSize
	}

	apiImage := utils.GetFullImageName(copy.Spec.Orchest.Registry, orchestApi, copy.Spec.Orchest.Version)
	if copy.Spec.Orchest.OrchestApi.Image != apiImage {
		changed = true
		copy.Spec.Orchest.OrchestApi.Image = apiImage
	}

	webserverImage := utils.GetFullImageName(copy.Spec.Orchest.Registry, orchestWebserver, copy.Spec.Orchest.Version)
	if copy.Spec.Orchest.OrchestWebServer.Image != webserverImage {
		changed = true
		copy.Spec.Orchest.OrchestWebServer.Image = webserverImage
	}

	celeryWorkerImage := utils.GetFullImageName(copy.Spec.Orchest.Registry, celeryWorker, copy.Spec.Orchest.Version)
	if copy.Spec.Orchest.CeleryWorker.Image != celeryWorkerImage {
		changed = true
		copy.Spec.Orchest.CeleryWorker.Image = celeryWorkerImage
	}

	authServerImage := utils.GetFullImageName(copy.Spec.Orchest.Registry, authServer, copy.Spec.Orchest.Version)
	if copy.Spec.Orchest.AuthServer.Image != authServerImage {
		changed = true
		copy.Spec.Orchest.AuthServer.Image = authServerImage
	}

	if changed {
		result, err := controller.oClient.OrchestV1alpha1().OrchestClusters(orchest.Namespace).Update(ctx, copy, metav1.UpdateOptions{})

		if err != nil {
			return nil, errors.Wrapf(err, "failed to update orchest with default values  %q", orchest.Name)
		}
		return result, nil
	}
	return orchest, nil
}

func (controller *OrchestClusterController) ensureThirdPartyDependencies(ctx context.Context,
	orchest *orchestv1alpha1.OrchestCluster) error {

	switch orchest.Status.Phase {
	case orchestv1alpha1.Initializing:
		// First step is to deploy Argo
		err := controller.updateClusterCondition(ctx, orchest,
			orchestv1alpha1.DeployingThirdParties, corev1.ConditionTrue, orchestv1alpha1.DeployingArgo)
		if err != nil {
			klog.Error(err)
			return err
		}
		fallthrough
	case orchestv1alpha1.DeployedThirdParties:
		err := controller.deployerManager.Get("argo").InstallIfChanged(ctx, orchest.Namespace, nil)
		if err != nil {
			klog.Error(err)
			return err
		}

		err = controller.updateCondition(ctx, orchest.Namespace, orchest.Name,
			orchestv1alpha1.DeployingThirdParties, corev1.ConditionTrue, orchestv1alpha1.DeployingRegistry)
		if err != nil {
			klog.Error(err)
			return err
		}

		err = controller.deployerManager.Get("registry").InstallIfChanged(ctx, orchest.Namespace, nil)
		if err != nil {
			klog.Error(err)
			return err
		}

		err = controller.updateCondition(ctx, orchest.Namespace, orchest.Name,
			orchestv1alpha1.DeployedThirdParties, corev1.ConditionTrue, "")
		if err != nil {
			klog.Error(err)
			return err
		}
	}

	return nil
}

func (controller *OrchestClusterController) updateCondition(ctx context.Context,
	namespace, name string,
	conditionType orchestv1alpha1.OrchestClusterPhase,
	status corev1.ConditionStatus,
	reason string) error {

	orchest, err := controller.ocLister.OrchestClusters(namespace).Get(name)
	if err != nil {
		if kerrors.IsNotFound(err) {
			klog.V(2).Info("OrchestCluster %s resource not found.", name)
			return nil
		}
		// Error reading OrchestCluster - The request will be requeued.
		return errors.Wrap(err, "failed to get OrchestCluster")
	}

	return controller.updateClusterCondition(ctx, orchest, conditionType, status, reason)
}

// UpdateClusterCondition function will export each condition into the cluster custom resource
func (controller *OrchestClusterController) updateClusterCondition(ctx context.Context,
	orchest *orchestv1alpha1.OrchestCluster,
	conditionType orchestv1alpha1.OrchestClusterPhase,
	status corev1.ConditionStatus,
	reason string) error {

	if orchest.Status == nil {
		orchest.Status = &orchestv1alpha1.OrchestClusterStatus{
			Conditions: make([]orchestv1alpha1.Condition, 0),
		}
	}

	conditions := make([]orchestv1alpha1.Condition, 0, len(orchest.Status.Conditions))
	var currentCondition *orchestv1alpha1.Condition
	for _, condition := range orchest.Status.Conditions {
		if conditionType == condition.Type && reason == condition.Reason {
			condition.LastHeartbeatTime = metav1.NewTime(time.Now())
			currentCondition = &condition
		}
		conditions = append(conditions, condition)
	}

	if currentCondition == nil {
		currentCondition = &orchestv1alpha1.Condition{
			Type:               conditionType,
			Status:             status,
			Reason:             reason,
			LastTransitionTime: metav1.NewTime(time.Now()),
			LastHeartbeatTime:  metav1.NewTime(time.Now()),
		}

		conditions = append(conditions, *currentCondition)
	}

	orchest.Status.Conditions = conditions

	if orchest.Status.Phase == orchestv1alpha1.Running ||
		orchest.Status.Phase == orchestv1alpha1.Paused {
		hash := ComputeHash(&orchest.Spec)
		orchest.Status.ObservedGeneration = orchest.Generation
		orchest.Status.ObservedHash = hash
	}

	orchest.Status.Phase = conditionType
	orchest.Status.Reason = reason

	_, err := controller.oClient.OrchestV1alpha1().OrchestClusters(orchest.Namespace).UpdateStatus(ctx, orchest, metav1.UpdateOptions{})
	if err != nil {
		return errors.Wrapf(err, "failed to update orchest with phase %q", orchest.Status.Phase)
	}

	return nil
}
