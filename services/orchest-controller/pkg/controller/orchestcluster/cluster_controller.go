package orchestcluster

import (
	"fmt"
	"path"
	"reflect"
	"time"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/client/clientset/versioned"
	orchestinformers "github.com/orchest/orchest/services/orchest-controller/pkg/client/informers/externalversions/orchest/v1alpha1"
	orchestlisters "github.com/orchest/orchest/services/orchest-controller/pkg/client/listers/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/controller"
	"github.com/orchest/orchest/services/orchest-controller/pkg/deployer"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	"github.com/orchest/orchest/services/orchest-controller/pkg/version"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
	corev1 "k8s.io/api/core/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"
	"k8s.io/klog/v2"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

var (
	OrchestClusterKind = orchestv1alpha1.SchemeGroupVersion.WithKind("OrchestCluster")
)

type ControllerConfig struct {
	DeployDir                      string
	PostgresDefaultImage           string
	RabbitmqDefaultImage           string
	OrchestDefaultVersion          string
	CeleryWorkerImageName          string
	OrchestApiImageName            string
	OrchestWebserverImageName      string
	AuthServerImageName            string
	UserdirDefaultVolumeSize       string
	BuilddirDefaultVolumeSize      string
	OrchestDefaultEnvVars          map[string]string
	OrchestApiDefaultEnvVars       map[string]string
	OrchestWebserverDefaultEnvVars map[string]string
	AuthServerDefaultEnvVars       map[string]string
	CeleryWorkerDefaultEnvVars     map[string]string
	OrchestDatabaseDefaultEnvVars  map[string]string
	RabbitmqDefaultEnvVars         map[string]string
	Threadiness                    int
	InCluster                      bool
	DefaultPause                   bool
}

func NewDefaultControllerConfig() ControllerConfig {
	return ControllerConfig{
		DeployDir:                 "/deploy",
		PostgresDefaultImage:      "postgres:13.1",
		RabbitmqDefaultImage:      "rabbitmq:3",
		OrchestDefaultVersion:     version.Version,
		CeleryWorkerImageName:     "orchest/celery-worker",
		OrchestApiImageName:       "orchest/orchest-api",
		OrchestWebserverImageName: "orchest/orchest-webserver",
		AuthServerImageName:       "orchest/auth-server",
		UserdirDefaultVolumeSize:  "50Gi",
		BuilddirDefaultVolumeSize: "25Gi",
		OrchestDefaultEnvVars: map[string]string{
			"PYTHONUNBUFFERED":  "TRUE",
			"ORCHEST_LOG_LEVEL": "INFO",
			"ORCHEST_HOST_GID":  "1",
		},
		OrchestApiDefaultEnvVars: map[string]string{
			"ORCHEST_GPU_ENABLED_INSTANCE": "FALSE",
			"FLASK_ENV":                    "production",
		},

		OrchestWebserverDefaultEnvVars: map[string]string{
			"ORCHEST_GPU_ENABLED_INSTANCE": "FALSE",
			"FLASK_ENV":                    "production",
			"ORCHEST_PORT":                 "8000",
			"USERDIR_PVC":                  "userdir-pvc",
			"HOST_CONFIG_DIR":              "/var/lib/orchest/config",
			"HOST_REPO_DIR":                "/var/lib/orchest/repo",
			"HOST_OS":                      "linux",
		},
		AuthServerDefaultEnvVars: map[string]string{
			"FLASK_ENV": "production",
		},
		CeleryWorkerDefaultEnvVars: map[string]string{
			"ORCHEST_GPU_ENABLED_INSTANCE":     "FALSE",
			"MAX_JOB_RUNS_PARALLELISM":         "1",
			"MAX_INTERACTIVE_RUNS_PARALLELISM": "1",
		},
		OrchestDatabaseDefaultEnvVars: map[string]string{
			"PGDATA":                    "/userdir/.orchest/database/data",
			"POSTGRES_HOST_AUTH_METHOD": "trust",
		},
		RabbitmqDefaultEnvVars: make(map[string]string, 0),
		Threadiness:            1,
		InCluster:              true,
		DefaultPause:           false,
	}
}

// OrchestClusterController reconciles OrchestCluster CRD.
type OrchestClusterController struct {
	*controller.Controller[*orchestv1alpha1.OrchestCluster]

	oClient versioned.Interface

	gClient client.Client

	scheme *runtime.Scheme

	config ControllerConfig

	oClusterLister orchestlisters.OrchestClusterLister

	oComponentLister orchestlisters.OrchestComponentLister

	deployerManager *deployer.DeployerManager
}

// NewOrchestClusterController returns a new *OrchestClusterController.
func NewOrchestClusterController(kClient kubernetes.Interface,
	oClient versioned.Interface,
	gClient client.Client,
	scheme *runtime.Scheme,
	config ControllerConfig,
	oClusterInformer orchestinformers.OrchestClusterInformer,
	oComponentInformer orchestinformers.OrchestComponentInformer,
) *OrchestClusterController {

	informerSyncedList := make([]cache.InformerSynced, 0, 0)

	ctrl := controller.NewController[*orchestv1alpha1.OrchestCluster](
		"orchest-cluster",
		1,
		kClient,
		OrchestClusterKind,
	)

	occ := OrchestClusterController{
		oClient: oClient,
		gClient: gClient,
		scheme:  scheme,
		config:  config,
	}

	// OrchestCluster event handlers
	oClusterInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    occ.addOrchestCluster,
		UpdateFunc: occ.updateOrchestCluster,
		DeleteFunc: occ.deleteOrchestCluster,
	})
	informerSyncedList = append(informerSyncedList, oClusterInformer.Informer().HasSynced)
	occ.oClusterLister = oClusterInformer.Lister()

	// OrchestComponent event handlers
	oComponentWatcher := controller.Watcher[*orchestv1alpha1.OrchestComponent, *orchestv1alpha1.OrchestCluster]{ctrl}
	oComponentInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    oComponentWatcher.AddObject,
		UpdateFunc: oComponentWatcher.UpdateObject,
		DeleteFunc: oComponentWatcher.DeleteObject,
	})
	informerSyncedList = append(informerSyncedList, oComponentInformer.Informer().HasSynced)
	occ.oComponentLister = oComponentInformer.Lister()

	ctrl.InformerSyncedList = informerSyncedList
	ctrl.SyncHandler = occ.syncOrchestCluster
	ctrl.ControleeGetter = occ.getOrchestCluster

	occ.Controller = ctrl

	occ.intiDeployerManager()

	return &occ
}

func (occ *OrchestClusterController) intiDeployerManager() {
	occ.deployerManager = deployer.NewDeployerManager()

	occ.deployerManager.AddDeployer("argo",
		deployer.NewHelmDeployer("argo",
			path.Join(occ.config.DeployDir, "thirdparty/argo-workflows"), ""))

	occ.deployerManager.AddDeployer("registry",
		deployer.NewHelmDeployer("registry",
			path.Join(occ.config.DeployDir, "thirdparty/docker-registry/helm"),
			path.Join(occ.config.DeployDir, "thirdparty/docker-registry/orchest-values.yaml")))
}

func (occ *OrchestClusterController) addOrchestCluster(obj interface{}) {
	oc := obj.(*orchestv1alpha1.OrchestCluster)
	klog.V(4).Infof("Adding OrchestCluster %s", oc.Name)
	occ.Enqueue(oc)
}

func (occ *OrchestClusterController) updateOrchestCluster(cur, old interface{}) {
	oldOc := old.(*orchestv1alpha1.OrchestCluster)
	curOc := cur.(*orchestv1alpha1.OrchestCluster)

	if curOc.UID != oldOc.UID {
		key, err := controller.KeyFunc(oldOc)
		if err != nil {
			utilruntime.HandleError(fmt.Errorf("couldn't get key for object %#v: %v", oldOc, err))
			return
		}
		occ.deleteOrchestCluster(cache.DeletedFinalStateUnknown{
			Key: key,
			Obj: oldOc,
		})
	}

	klog.V(4).Infof("Updating OrchestCluster %s", oldOc.Name)
	occ.Enqueue(curOc)
}

func (occ *OrchestClusterController) deleteOrchestCluster(obj interface{}) {
	oc, ok := obj.(*orchestv1alpha1.OrchestCluster)
	if !ok {
		tombstone, ok := obj.(cache.DeletedFinalStateUnknown)
		if !ok {
			utilruntime.HandleError(fmt.Errorf("couldn't get object from tombstone %#v", obj))
			return
		}
		oc, ok = tombstone.Obj.(*orchestv1alpha1.OrchestCluster)
		if !ok {
			utilruntime.HandleError(fmt.Errorf("tombstone contained object that is not a OrchestCluster %#v", obj))
			return
		}
	}
	klog.V(4).Infof("Deleting OrchestCluster %s", oc.Name)

	occ.Enqueue(oc)
}

func (occ *OrchestClusterController) getOrchestCluster(namespace, name string) (
	interface{}, error) {
	return occ.oClusterLister.OrchestClusters(namespace).Get(name)
}

func (occ *OrchestClusterController) syncOrchestCluster(ctx context.Context, key string) error {

	startTime := time.Now()
	klog.V(3).Infof("Started syncing OrchestCluster: %s.", key)
	defer func() {
		klog.V(3).Infof("Finished syncing OrchestCluster: %s. duration: (%v)", key, time.Since(startTime))
	}()

	namespace, name, err := cache.SplitMetaNamespaceKey(key)
	if err != nil {
		return err
	}

	orchest, err := occ.oClient.OrchestV1alpha1().OrchestClusters(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		if kerrors.IsNotFound(err) {
			klog.V(2).Info("OrchestCluster %s resource not found.", key)
			return nil
		}
		// Error reading OrchestCluster - The request will be requeued.
		return errors.Wrapf(err, "failed to get to OrchestCluster %s", key)
	}

	if !orchest.GetDeletionTimestamp().IsZero() {
		// The cluster is deleted, we need to stop it first, then remove the finalizer
		stopped, err := occ.stopOrchest(ctx, orchest)
		if err != nil {
			return nil
		}

		if stopped {
			_, err = controller.RemoveFinalizerIfPresent(ctx, occ.gClient, orchest, orchestv1alpha1.Finalizer)
			return err
		}
		return nil
	}

	// Set a finalizer so we can do cleanup before the object goes away
	changed, err := controller.AddFinalizerIfNotPresent(ctx, occ.gClient, orchest, orchestv1alpha1.Finalizer)
	if changed || err != nil {
		return err
	}

	// If Status struct is not initialized yet, the cluster is new, create it
	if orchest.Status == nil {
		// Set the default values in CR if not specified
		err = occ.updatePhase(ctx, namespace, name, orchestv1alpha1.Initializing, "Initializing Orchest Cluster")
		if err != nil {
			klog.Error(err)
			return err
		}
	}

	ok, err := occ.validateOrchestCluster(ctx, orchest)
	if err != nil {
		klog.Error(err)
		return err
	}

	if !ok {
		err = occ.updatePhase(ctx, namespace, name, orchestv1alpha1.Error, fmt.Sprintf("OrchestCluster object is not valid %s", key))
		if err != nil {
			klog.Error(err)
			return err
		}
	}

	changed, err = occ.setDefaultIfNotSpecified(ctx, orchest)
	if err != nil {
		return err
	}

	// If the object is changed, we return and the object will be requeued.
	if changed {
		return nil
	}

	err = occ.ensureThirdPartyDependencies(ctx, orchest)
	if err != nil {
		return err
	}

	return occ.manageOrchestCluster(ctx, orchest)
}

func (occ *OrchestClusterController) validateOrchestCluster(ctx context.Context, orchest *orchestv1alpha1.OrchestCluster) (bool, error) {

	var err error
	if orchest.Spec.Orchest.Resources.StorageClassName != "" {
		_, err := occ.Client().StorageV1().StorageClasses().Get(ctx, orchest.Spec.Orchest.Resources.StorageClassName, metav1.GetOptions{})
		if err != nil && kerrors.IsNotFound(err) {
			return false, nil
		}
	}
	return true, err
}

func (occ *OrchestClusterController) setDefaultIfNotSpecified(ctx context.Context,
	orchest *orchestv1alpha1.OrchestCluster) (bool, error) {

	orchest, err := occ.oClient.OrchestV1alpha1().OrchestClusters(orchest.Namespace).Get(ctx, orchest.Name, metav1.GetOptions{})
	if err != nil {
		if kerrors.IsNotFound(err) {
			klog.V(2).Info("OrchestCluster %s resource not found.", orchest.Name)
			return false, nil
		}
		// Error reading OrchestCluster - The request will be requeued.
		return false, errors.Wrap(err, "failed to get OrchestCluster")
	}

	if orchest.Status.ObservedGeneration == orchest.Generation {
		return false, nil
	}

	copy := orchest.DeepCopy()

	changed := false

	// Orchest configs
	if copy.Spec.Orchest.Version == "" {
		changed = true
		copy.Spec.Orchest.Version = occ.config.OrchestDefaultVersion
	}

	if copy.Spec.Orchest.Pause == nil {
		changed = true
		copy.Spec.Orchest.Pause = &occ.config.DefaultPause
	}

	if copy.Spec.Orchest.Env == nil {
		changed = true
		copy.Spec.Orchest.Env = make([]corev1.EnvVar, 0, len(occ.config.OrchestDefaultEnvVars))
	}

	envChanged := utils.UpsertEnvVariable(&copy.Spec.Orchest.Env,
		occ.config.OrchestDefaultEnvVars, false)
	if envChanged {
		changed = true
	}

	envChanged = utils.UpsertEnvVariable(&copy.Spec.Orchest.Env,
		map[string]string{
			"ORCHEST_CLUSTER":   orchest.Name,
			"ORCHEST_NAMESPACE": orchest.Namespace,
		}, false)
	if envChanged {
		changed = true
	}

	if copy.Spec.Orchest.OrchestHost != nil {
		envChanged := utils.UpsertEnvVariable(&copy.Spec.Orchest.Env,
			map[string]string{"ORCHEST_FQDN": *copy.Spec.Orchest.OrchestHost}, true)
		if envChanged {
			changed = true
		}
	}

	// Orchest-API configs
	apiImage := utils.GetFullImageName(copy.Spec.Orchest.Registry, controller.OrchestApi, copy.Spec.Orchest.Version)
	if copy.Spec.Orchest.OrchestApi.Image != apiImage {
		changed = true
		copy.Spec.Orchest.OrchestApi.Image = apiImage
	}

	if copy.Spec.Orchest.OrchestApi.Env == nil {
		changed = true
		copy.Spec.Orchest.OrchestApi.Env = make([]corev1.EnvVar, 0, len(occ.config.OrchestApiDefaultEnvVars))
	}

	envChanged = utils.UpsertEnvVariable(&copy.Spec.Orchest.OrchestApi.Env,
		occ.config.OrchestApiDefaultEnvVars, false)
	if envChanged {
		changed = true
	}

	// Orchest-Webserver configs
	webserverImage := utils.GetFullImageName(copy.Spec.Orchest.Registry, controller.OrchestWebserver, copy.Spec.Orchest.Version)
	if copy.Spec.Orchest.OrchestWebServer.Image != webserverImage {
		changed = true
		copy.Spec.Orchest.OrchestWebServer.Image = webserverImage
	}

	if copy.Spec.Orchest.OrchestWebServer.Env == nil {
		changed = true
		copy.Spec.Orchest.OrchestWebServer.Env = make([]corev1.EnvVar, 0, len(occ.config.OrchestWebserverDefaultEnvVars))
	}

	envChanged = utils.UpsertEnvVariable(&copy.Spec.Orchest.OrchestWebServer.Env,
		occ.config.OrchestWebserverDefaultEnvVars, false)
	if envChanged {
		changed = true
	}

	// Celery-Worker configs
	celeryWorkerImage := utils.GetFullImageName(copy.Spec.Orchest.Registry, controller.CeleryWorker, copy.Spec.Orchest.Version)
	if copy.Spec.Orchest.CeleryWorker.Image != celeryWorkerImage {
		changed = true
		copy.Spec.Orchest.CeleryWorker.Image = celeryWorkerImage
	}

	if copy.Spec.Orchest.CeleryWorker.Env == nil {
		changed = true
		copy.Spec.Orchest.CeleryWorker.Env = make([]corev1.EnvVar, 0, len(occ.config.CeleryWorkerDefaultEnvVars))
	}

	envChanged = utils.UpsertEnvVariable(&copy.Spec.Orchest.CeleryWorker.Env,
		occ.config.CeleryWorkerDefaultEnvVars, false)
	if envChanged {
		changed = true
	}

	// Auth-Server configs
	authServerImage := utils.GetFullImageName(copy.Spec.Orchest.Registry, controller.AuthServer, copy.Spec.Orchest.Version)
	if copy.Spec.Orchest.AuthServer.Image != authServerImage {
		changed = true
		copy.Spec.Orchest.AuthServer.Image = authServerImage
	}

	if copy.Spec.Orchest.AuthServer.Env == nil {
		changed = true
		copy.Spec.Orchest.AuthServer.Env = make([]corev1.EnvVar, 0, len(occ.config.AuthServerDefaultEnvVars))
	}

	envChanged = utils.UpsertEnvVariable(&copy.Spec.Orchest.AuthServer.Env,
		occ.config.AuthServerDefaultEnvVars, false)
	if envChanged {
		changed = true
	}

	nodeAgentImage := utils.GetFullImageName(copy.Spec.Orchest.Registry, controller.NodeAgent, copy.Spec.Orchest.Version)
	if copy.Spec.Orchest.NodeAgent.Image != nodeAgentImage {
		changed = true
		copy.Spec.Orchest.NodeAgent.Image = nodeAgentImage
	}

	// Postgres configs
	if copy.Spec.Postgres.Image == "" {
		changed = true
		copy.Spec.Postgres.Image = occ.config.PostgresDefaultImage
	}

	if copy.Spec.Postgres.Env == nil && len(occ.config.OrchestDatabaseDefaultEnvVars) != 0 {
		changed = true
		copy.Spec.Postgres.Env = utils.GetEnvVarFromMap(occ.config.OrchestDatabaseDefaultEnvVars)
	}

	// RabbitMq configs
	if copy.Spec.RabbitMq.Image == "" {
		changed = true
		copy.Spec.RabbitMq.Image = occ.config.RabbitmqDefaultImage
	}

	if copy.Spec.RabbitMq.Env == nil && len(occ.config.RabbitmqDefaultEnvVars) != 0 {
		changed = true
		copy.Spec.RabbitMq.Env = utils.GetEnvVarFromMap(occ.config.RabbitmqDefaultEnvVars)
	}

	if copy.Spec.Orchest.Resources.UserDirVolumeSize == "" {
		changed = true
		copy.Spec.Orchest.Resources.UserDirVolumeSize = occ.config.UserdirDefaultVolumeSize
	}

	if copy.Spec.Orchest.Resources.BuilderCacheDirVolumeSize == "" {
		changed = true
		copy.Spec.Orchest.Resources.BuilderCacheDirVolumeSize = occ.config.BuilddirDefaultVolumeSize
	}

	if changed || !reflect.DeepEqual(copy.Spec, orchest.Spec) {
		_, err := occ.oClient.OrchestV1alpha1().OrchestClusters(orchest.Namespace).Update(ctx, copy, metav1.UpdateOptions{})

		if err != nil {
			return false, errors.Wrapf(err, "failed to update orchest with default values  %q", orchest.Name)
		}

		klog.Infof("OrchestCluster is updated with default values %s", orchest.Name)
		return true, nil

	}
	return false, nil
}

func (occ *OrchestClusterController) ensureThirdPartyDependencies(ctx context.Context,
	orchest *orchestv1alpha1.OrchestCluster) (err error) {

	switch orchest.Status.Phase {
	case orchestv1alpha1.Initializing:
		err = occ.updatePhase(ctx, orchest.Namespace, orchest.Name, orchestv1alpha1.DeployingThirdParties, "")
		if err != nil {
			klog.Error(err)
			return err
		}
		fallthrough
	case orchestv1alpha1.DeployingThirdParties:
		defer func() {
			if err == nil {
				err = occ.updatePhase(ctx, orchest.Namespace, orchest.Name, orchestv1alpha1.DeployedThirdParties, "")
			}
		}()

		err = occ.deployerManager.Get("argo").InstallIfChanged(ctx, orchest.Namespace, nil)
		if err != nil {
			klog.Error(err)
			return err
		}

		err = occ.updateCondition(ctx, orchest.Namespace, orchest.Name, orchestv1alpha1.CreatingCertificates)
		if err != nil {
			klog.Error(err)
			return err
		}

		err = registryCertgen(ctx, occ.Client(), orchest)
		if err != nil {
			klog.Error(err)
			return err
		}

		err = occ.updateCondition(ctx, orchest.Namespace, orchest.Name, orchestv1alpha1.DeployingRegistry)
		if err != nil {
			klog.Error(err)
			return err
		}

		err = occ.deployerManager.Get("registry").InstallIfChanged(ctx, orchest.Namespace, nil)
		if err != nil {
			klog.Error(err)
			return err
		}
	}

	return nil
}

// Installs deployer if the config is changed
func (occ *OrchestClusterController) manageOrchestCluster(ctx context.Context, orchest *orchestv1alpha1.OrchestCluster) (err error) {

	if orchest.Status == nil || orchest.Status.Phase == orchestv1alpha1.Initializing {
		return errors.Errorf("status object is not initialzed yet %s", orchest.Name)
	}
	stopped := false
	nextPhase, endPhase := determineNextPhase(orchest)
	if nextPhase == endPhase {
		return
	}
	err = occ.updatePhase(ctx, orchest.Namespace, orchest.Name, nextPhase, "")
	defer func() {
		if err == nil && stopped {
			err = occ.updatePhase(ctx, orchest.Namespace, orchest.Name, endPhase, "")
		}
	}()
	if err != nil {
		return err
	}

	// If endPhase is Paused or nextPhase is Pausing the cluster should be paused first
	if endPhase == orchestv1alpha1.Stopped || nextPhase == orchestv1alpha1.Stopping {
		stopped, err = occ.stopOrchest(ctx, orchest)
		return err
	}

	generation := fmt.Sprint(orchest.Generation)

	err = occ.ensurePvc(ctx, generation, controller.UserDirName,
		orchest.Spec.Orchest.Resources.UserDirVolumeSize, orchest)
	if err != nil {
		return err
	}

	err = occ.ensurePvc(ctx, generation, controller.BuilderDirName,
		orchest.Spec.Orchest.Resources.UserDirVolumeSize, orchest)
	if err != nil {
		return err
	}

	err = occ.ensureRbacs(ctx, generation, orchest)
	if err != nil {
		return err
	}

	// Deploy and Update
	components, err := GetOrchetComponents(ctx, orchest, occ.oComponentLister)
	if err != nil {
		return err
	}

	for _, componentName := range orderOfDeployment {
		component, ok := components[componentName]
		if ok {
			// If component is not ready, the key will be requeued to be checked later
			if !controller.IsComponentReady(*component) {
				occ.EnqueueAfter(orchest)
				return
			}
		} else {

			// component does not exist, let't create it
			componentTemplate, err := GetComponentTemplate(componentName, orchest)
			if err != nil {
				return err
			}

			err = occ.updateCondition(ctx, orchest.Namespace, orchest.Name,
				orchestv1alpha1.OrchestClusterEvent(fmt.Sprintf("deploying %s", componentName)))
			if err != nil {
				return errors.Wrapf(err, "failed to update status while changing the state to DeployingOrchest")
			}

			newComponent := getOrchestComponent(componentName, generation, componentTemplate, orchest)

			// Creating Orchest Component
			_, err = occ.oClient.OrchestV1alpha1().OrchestComponents(orchest.Namespace).
				Create(ctx, newComponent, metav1.CreateOptions{})
			return err
		}
	}

	stopped = true
	return err
}

func (occ *OrchestClusterController) stopOrchest(ctx context.Context, orchest *orchestv1alpha1.OrchestCluster) (bool, error) {

	stopped := false

	// Get the current Components
	components, err := GetOrchetComponents(ctx, orchest, occ.oComponentLister)
	if err != nil {
		return stopped, err
	}

	if len(components) > 0 {
		for i := len(orderOfDeployment) - 1; i >= 0; i-- {
			component, ok := components[orderOfDeployment[i]]

			// component exist
			if ok {
				// If component is already deleted we wait for OrchestComponentController to gracefully delete it
				// and we requeue the OrchestCluster for continution
				if !component.GetDeletionTimestamp().IsZero() {
					occ.EnqueueAfter(orchest)
					return stopped, nil
				} else {
					// The Component is not deleted, we will delete it
					return stopped, occ.oClient.OrchestV1alpha1().OrchestComponents(orchest.Namespace).
						Delete(ctx, component.Name, metav1.DeleteOptions{})
				}
			}
		}
	}
	// The cluster is paused, remove the restart annotation if present
	_, err = controller.RemoveAnnotation(ctx, occ.gClient, orchest, controller.RestartAnnotationKey)

	stopped = true
	return stopped, err
}

func (occ *OrchestClusterController) ensurePvc(ctx context.Context, curHash, name, size string, orchest *orchestv1alpha1.OrchestCluster) error {

	// Retrive the created pvcs
	oldPvc, err := occ.Client().CoreV1().PersistentVolumeClaims(orchest.Namespace).Get(ctx, name, metav1.GetOptions{})
	newPvc := getPersistentVolumeClaim(name, size, curHash, orchest)
	// userdir is not created or is removed, we have to recreate it
	if err != nil && kerrors.IsNotFound(err) {
		_, err := occ.Client().CoreV1().PersistentVolumeClaims(orchest.Namespace).Create(ctx, newPvc, metav1.CreateOptions{})
		if err != nil {
			return errors.Wrapf(err, "failed to create %s pvc", name)
		}
		return nil
	} else if err != nil {
		return err
	}

	return occ.adoptPVC(ctx, oldPvc, newPvc)

}

func (occ *OrchestClusterController) adoptPVC(ctx context.Context, oldPvc, newPvc *corev1.PersistentVolumeClaim) error {

	if !reflect.DeepEqual(oldPvc.OwnerReferences[0], newPvc.OwnerReferences[0]) {
		oldPvc.OwnerReferences = newPvc.OwnerReferences
		_, err := occ.Client().CoreV1().PersistentVolumeClaims(oldPvc.Namespace).Update(ctx, oldPvc, metav1.UpdateOptions{})
		return err
	}
	return nil
}

func (occ *OrchestClusterController) ensureRbacs(ctx context.Context, hash string, orchest *orchestv1alpha1.OrchestCluster) error {

	objects := make([]client.Object, 0, 6)
	apiMetadata := controller.GetMetadata(controller.OrchestApi, hash, orchest, OrchestClusterKind)
	// Get the rbac manifest
	objects = append(objects, controller.GetRbacManifest(apiMetadata)...)

	celeryMetadata := controller.GetMetadata(controller.CeleryWorker, hash, orchest, OrchestClusterKind)
	objects = append(objects, controller.GetRbacManifest(celeryMetadata)...)

	for _, obj := range objects {
		err := controller.UpsertObject(ctx, occ.gClient, obj)
		if err != nil {
			return err
		}
	}

	return nil
}

func (occ *OrchestClusterController) updatePhase(ctx context.Context,
	namespace, name string,
	phase orchestv1alpha1.OrchestPhase, reason string) error {

	orchest, err := occ.oClient.OrchestV1alpha1().OrchestClusters(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		if kerrors.IsNotFound(err) {
			klog.V(2).Info("OrchestCluster %s resource not found.", name)
			return nil
		}
		// Error reading OrchestCluster - The request will be requeued.
		return errors.Wrap(err, "failed to get OrchestCluster")
	}

	if orchest.Status != nil && orchest.Status.Phase == phase {
		return nil
	} else if orchest.Status != nil {
		orchest.Status.Phase = phase
		orchest.Status.LastHeartbeatTime = metav1.NewTime(time.Now())
		orchest.Status.Conditions = nil
	} else {
		orchest.Status = &orchestv1alpha1.OrchestClusterStatus{
			Phase:             phase,
			LastHeartbeatTime: metav1.NewTime(time.Now()),
		}

	}

	if orchest.Status.Phase == orchestv1alpha1.Running ||
		orchest.Status.Phase == orchestv1alpha1.Starting ||
		orchest.Status.Phase == orchestv1alpha1.DeployingOrchest ||
		orchest.Status.Phase == orchestv1alpha1.Stopped {

		orchest.Status.ObservedHash = controller.ComputeHash(&orchest.Spec)

		if orchest.Status.Phase != orchestv1alpha1.Starting &&
			orchest.Status.Phase != orchestv1alpha1.DeployingOrchest {
			orchest.Status.ObservedGeneration = orchest.Generation
		}
	}

	_, err = occ.oClient.OrchestV1alpha1().OrchestClusters(orchest.Namespace).UpdateStatus(ctx, orchest, metav1.UpdateOptions{})
	if err != nil {
		return errors.Wrapf(err, "failed to update orchest with phase %q", orchest.Status.Phase)
	}

	return nil
}

func (occ *OrchestClusterController) updateCondition(ctx context.Context,
	namespace, name string,
	event orchestv1alpha1.OrchestClusterEvent) error {

	orchest, err := occ.oClient.OrchestV1alpha1().OrchestClusters(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		if kerrors.IsNotFound(err) {
			klog.V(2).Info("OrchestCluster %s resource not found.", name)
			return nil
		}
		// Error reading OrchestCluster - The request will be requeued.
		return errors.Wrap(err, "failed to get OrchestCluster")
	}

	return occ.updateClusterCondition(ctx, orchest, event)
}

// UpdateClusterCondition function will export each condition into the cluster custom resource
func (occ *OrchestClusterController) updateClusterCondition(ctx context.Context,
	orchest *orchestv1alpha1.OrchestCluster,
	event orchestv1alpha1.OrchestClusterEvent) error {

	if orchest.Status == nil {
		return occ.updatePhase(ctx, orchest.Namespace, orchest.Name, orchestv1alpha1.Initializing, "")
	}

	conditions := make([]orchestv1alpha1.Condition, 0, len(orchest.Status.Conditions)+1)
	var currentCondition *orchestv1alpha1.Condition
	for _, condition := range orchest.Status.Conditions {
		if event == condition.Event {
			condition.LastHeartbeatTime = metav1.NewTime(time.Now())
			currentCondition = &condition
		}
		conditions = append(conditions, condition)
	}

	if currentCondition == nil {
		currentCondition = &orchestv1alpha1.Condition{
			Event:              event,
			LastTransitionTime: metav1.NewTime(time.Now()),
			LastHeartbeatTime:  metav1.NewTime(time.Now()),
		}

		conditions = append(conditions, *currentCondition)
	}

	orchest.Status.Conditions = conditions

	_, err := occ.oClient.OrchestV1alpha1().OrchestClusters(orchest.Namespace).UpdateStatus(ctx, orchest, metav1.UpdateOptions{})
	if err != nil {
		return errors.Wrapf(err, "failed to update orchest with phase %q", orchest.Status.Phase)
	}

	return nil
}
