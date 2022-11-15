package orchestcluster

import (
	"fmt"
	"reflect"
	"strings"
	"sync"
	"time"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/client/clientset/versioned"
	orchestinformers "github.com/orchest/orchest/services/orchest-controller/pkg/client/informers/externalversions/orchest/v1alpha1"
	orchestlisters "github.com/orchest/orchest/services/orchest-controller/pkg/client/listers/orchest/v1alpha1"
	registry "github.com/orchest/orchest/services/orchest-controller/pkg/componentregistry"
	"github.com/orchest/orchest/services/orchest-controller/pkg/controller"
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
	// Postgres default image to use if not provided
	PostgresDefaultImage string
	// Rabbitmq default image to use if not provided
	RabbitmqDefaultImage string
	// Orchest Default version to use if not provided
	OrchestDefaultVersion string
	// celery-worker default image to use if not provided
	CeleryWorkerImageName string
	// orchest-api default image to use if not provided
	OrchestApiImageName string
	// orchest-webserver default image to use if not provided
	OrchestWebserverImageName string
	// auth-server default image to use if not provided
	AuthServerImageName string
	// user-dir volume size if not provided
	UserdirDefaultVolumeSize string
	// build-dir volume size if not provided
	BuilddirDefaultVolumeSize string
	// default env vars for orchest services
	OrchestDefaultEnvVars map[string]string
	// default env vars for orchest-api
	OrchestApiDefaultEnvVars map[string]string
	// default env vars for orchest-webserver
	OrchestWebserverDefaultEnvVars map[string]string
	// default env vars for auth-server
	AuthServerDefaultEnvVars map[string]string
	// default env vars for celery-worker
	CeleryWorkerDefaultEnvVars map[string]string
	// default env vars for orchest-database
	OrchestDatabaseDefaultEnvVars map[string]string
	// default env vars for rabbitmq
	RabbitmqDefaultEnvVars map[string]string
	// default third-party applications
	DefaultApplications []orchestv1alpha1.ApplicationSpec
	Threadiness         int
	InCluster           bool
	DefaultPause        bool
}

func NewDefaultControllerConfig() ControllerConfig {
	return ControllerConfig{
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
			"ORCHEST_GPU_ENABLED_INSTANCE": "FALSE",
			"FLASK_ENV":                    "production",
		},
		OrchestDatabaseDefaultEnvVars: map[string]string{
			"PGDATA":                    "/userdir/.orchest/database/data",
			"POSTGRES_HOST_AUTH_METHOD": "trust",
		},
		DefaultApplications: []orchestv1alpha1.ApplicationSpec{
			{
				Name: registry.ArgoWorkflow,
				Config: orchestv1alpha1.ApplicationConfig{
					Helm: &orchestv1alpha1.ApplicationConfigHelm{
						Parameters: []orchestv1alpha1.HelmParameter{
							{
								Name:  "singleNamespace",
								Value: "true",
							},
						},
					},
				},
			},
			{
				Name: registry.DockerRegistry,
			},
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

	k8sDistro utils.KubernetesDistros

	oClusterLister orchestlisters.OrchestClusterLister

	clustersLock    sync.RWMutex
	orchestClusters map[string]*OrchestStateMachine
}

// NewOrchestClusterController returns a new *OrchestClusterController.
func NewOrchestClusterController(kClient kubernetes.Interface,
	oClient versioned.Interface,
	gClient client.Client,
	scheme *runtime.Scheme,
	config ControllerConfig,
	k8sDistro utils.KubernetesDistros,
	oClusterInformer orchestinformers.OrchestClusterInformer,
) *OrchestClusterController {

	informerSyncedList := make([]cache.InformerSynced, 0)

	ctrl := controller.NewController[*orchestv1alpha1.OrchestCluster](
		"orchest-cluster",
		1,
		kClient,
		&OrchestClusterKind,
	)

	occ := OrchestClusterController{
		oClient:         oClient,
		gClient:         gClient,
		scheme:          scheme,
		config:          config,
		k8sDistro:       k8sDistro,
		orchestClusters: make(map[string]*OrchestStateMachine),
	}

	// OrchestCluster event handlers
	oClusterInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    occ.addOrchestCluster,
		UpdateFunc: occ.updateOrchestCluster,
		DeleteFunc: occ.deleteOrchestCluster,
	})
	informerSyncedList = append(informerSyncedList, oClusterInformer.Informer().HasSynced)
	occ.oClusterLister = oClusterInformer.Lister()

	ctrl.InformerSyncedList = informerSyncedList
	ctrl.SyncHandler = occ.syncOrchestCluster
	ctrl.ControleeGetter = occ.getOrchestCluster

	occ.Controller = ctrl

	return &occ
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

func (occ *OrchestClusterController) getOrchestStateMachine(key string) *OrchestStateMachine {
	occ.clustersLock.RLock()
	defer occ.clustersLock.RUnlock()
	stateMachine, ok := occ.orchestClusters[key]
	if !ok {
		return nil
	}
	return stateMachine
}

func (occ *OrchestClusterController) syncOrchestCluster(ctx context.Context, key string) error {

	startTime := time.Now()
	klog.V(3).Infof("Started syncing OrchestCluster: %s.", key)
	defer func() {
		klog.V(3).Infof("Finished syncing OrchestCluster: %s. duration: (%v)", key, time.Since(startTime))
	}()

	return occ.manageOrchestCluster(ctx, key)
}

func (occ *OrchestClusterController) validateOrchestCluster(ctx context.Context, orchest *orchestv1alpha1.OrchestCluster) (bool, error) {

	var err error
	if orchest.Spec.Orchest.Resources.StorageClassName != "" {
		_, err := occ.Client().StorageV1().StorageClasses().Get(ctx, orchest.Spec.Orchest.Resources.StorageClassName, metav1.GetOptions{})
		if err != nil && kerrors.IsNotFound(err) {
			return false, nil
		}
	}

	// Detect runtime environment
	runtime, socketPath, err := detectContainerRuntime(ctx, occ.Client(), orchest)
	if err != nil {
		return false, err
	}
	occ.config.OrchestDefaultEnvVars["CONTAINER_RUNTIME"] = runtime
	// Some k8s flavours place "unix://" in front of the path.
	occ.config.OrchestDefaultEnvVars["CONTAINER_RUNTIME_SOCKET"] = strings.Replace(socketPath, "unix://", "", -1)
	occ.config.OrchestDefaultEnvVars["CONTAINER_RUNTIME_IMAGE"] = utils.GetFullImageName(orchest.Spec.Orchest.Registry,
		"image-puller", occ.config.OrchestDefaultVersion)
	occ.config.OrchestDefaultEnvVars["K8S_DISTRO"] = string(occ.k8sDistro)

	// Update the creation stages based on runtime
	if runtime != "containerd" {
		creationStages[0] = []string{controller.OrchestDatabase, controller.Rabbitmq}
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

	if copy.Spec.SingleNode == nil {
		changed = true
		True := true
		copy.Spec.SingleNode = &True
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
	changed = changed || envChanged

	envChanged = utils.UpsertEnvVariable(&copy.Spec.Orchest.Env,
		map[string]string{
			"ORCHEST_CLUSTER":   orchest.Name,
			"ORCHEST_NAMESPACE": orchest.Namespace,
		}, false)
	changed = changed || envChanged

	if copy.Spec.Orchest.OrchestHost != nil {
		envChanged := utils.UpsertEnvVariable(&copy.Spec.Orchest.Env,
			map[string]string{"ORCHEST_FQDN": *copy.Spec.Orchest.OrchestHost}, true)
		changed = changed || envChanged
	}

	// Orchest-API configs
	newImage, update := isUpdateRequired(copy, controller.OrchestApi, copy.Spec.Orchest.OrchestApi.Image)
	if update {
		changed = true
		copy.Spec.Orchest.OrchestApi.Image = newImage
	}

	if copy.Spec.Orchest.OrchestApi.Env == nil {
		changed = true
		copy.Spec.Orchest.OrchestApi.Env = make([]corev1.EnvVar, 0, len(occ.config.OrchestApiDefaultEnvVars))
	}

	envChanged = utils.UpsertEnvVariable(&copy.Spec.Orchest.OrchestApi.Env,
		occ.config.OrchestApiDefaultEnvVars, false)
	envChanged = utils.UpsertEnvVariable(
		&copy.Spec.Orchest.OrchestApi.Env,
		map[string]string{"SINGLE_NODE": strings.ToUpper(fmt.Sprintf("%t", *copy.Spec.SingleNode))},
		true,
	) || envChanged
	changed = changed || envChanged

	// Orchest-Webserver configs
	newImage, update = isUpdateRequired(copy, controller.OrchestWebserver, copy.Spec.Orchest.OrchestWebServer.Image)
	if update {
		changed = true
		copy.Spec.Orchest.OrchestWebServer.Image = newImage
	}

	if copy.Spec.Orchest.OrchestWebServer.Env == nil {
		changed = true
		copy.Spec.Orchest.OrchestWebServer.Env = make([]corev1.EnvVar, 0, len(occ.config.OrchestWebserverDefaultEnvVars))
	}

	envChanged = utils.UpsertEnvVariable(&copy.Spec.Orchest.OrchestWebServer.Env,
		occ.config.OrchestWebserverDefaultEnvVars, false)
	changed = changed || envChanged

	// Celery-Worker configs
	newImage, update = isUpdateRequired(copy, controller.CeleryWorker, copy.Spec.Orchest.CeleryWorker.Image)
	if update {
		changed = true
		copy.Spec.Orchest.CeleryWorker.Image = newImage
	}

	if copy.Spec.Orchest.CeleryWorker.Env == nil {
		changed = true
		copy.Spec.Orchest.CeleryWorker.Env = make([]corev1.EnvVar, 0, len(occ.config.CeleryWorkerDefaultEnvVars))
	}

	envChanged = utils.UpsertEnvVariable(&copy.Spec.Orchest.CeleryWorker.Env,
		occ.config.CeleryWorkerDefaultEnvVars, false)
	envChanged = utils.UpsertEnvVariable(
		&copy.Spec.Orchest.CeleryWorker.Env,
		map[string]string{"SINGLE_NODE": strings.ToUpper(fmt.Sprintf("%t", *copy.Spec.SingleNode))},
		true,
	) || envChanged
	changed = changed || envChanged

	// Auth-Server configs
	newImage, update = isUpdateRequired(copy, controller.AuthServer, copy.Spec.Orchest.AuthServer.Image)
	if update {
		changed = true
		copy.Spec.Orchest.AuthServer.Image = newImage
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

	// BuildKitDaemon configs
	buildKitDaemonImage := utils.GetFullImageName(copy.Spec.Orchest.Registry, controller.BuildKitDaemon, copy.Spec.Orchest.Version)
	if copy.Spec.Orchest.BuildKitDaemon.Image != buildKitDaemonImage {
		changed = true
		copy.Spec.Orchest.BuildKitDaemon.Image = buildKitDaemonImage
	}

	if copy.Spec.Applications == nil {
		changed = true

		copy.Spec.Applications = map[string]orchestv1alpha1.ApplicationSpec{}
		for _, app := range occ.config.DefaultApplications {
			// we enable the annotation, then the config will be added later
			copy.Annotations[controller.GetAppAnnotationKey(app.Name)] = "true"
		}
	}

	for name, configFunc := range thirdPartyConfigFuncs {
		appChanged := syncThirdPartyApplication(occ.Client(), name, copy, occ.k8sDistro, configFunc)
		changed = changed || appChanged
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

func (occ *OrchestClusterController) removeOrchestCluster(key string) {

	occ.clustersLock.Lock()
	defer occ.clustersLock.Unlock()

	delete(occ.orchestClusters, key)

}

// Installs deployer if the config is changed
func (occ *OrchestClusterController) manageOrchestCluster(ctx context.Context, key string) (err error) {

	occ.clustersLock.Lock()
	defer occ.clustersLock.Unlock()

	cluster, ok := occ.orchestClusters[key]
	if !ok {
		cluster, err = NewOrchestStateMachine(key, occ)
		occ.orchestClusters[key] = cluster
		go cluster.run(context.Background())

		return err
	}

	return cluster.manage(ctx)
}

func (occ *OrchestClusterController) stopOrchest(ctx context.Context, orchest *orchestv1alpha1.OrchestCluster) (bool, error) {
	return false, nil
}

func (occ *OrchestClusterController) UpdatePhase(ctx context.Context,
	namespace, name string,
	phase orchestv1alpha1.OrchestPhase) error {

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

		orchest.Status.ObservedHash = utils.ComputeHash(&orchest.Spec)

		if orchest.Status.Phase == orchestv1alpha1.Running || orchest.Status.Phase == orchestv1alpha1.Stopped {
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
	event string) error {

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
	event string) error {

	if orchest.Status == nil {
		return occ.UpdatePhase(ctx, orchest.Namespace, orchest.Name, orchestv1alpha1.Initializing)
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
