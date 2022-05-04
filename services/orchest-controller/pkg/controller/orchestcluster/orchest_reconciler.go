package orchestcluster

import (
	"context"
	"fmt"
	"reflect"
	"time"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/client/clientset/versioned"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	"github.com/pkg/errors"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"
	"k8s.io/klog/v2"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

var (

	// values used to created underlying resources
	isController       = true
	blockOwnerDeletion = true

	userDirName    = "userdir-pvc"
	builderDirName = "image-builder-cache-pvc"

	userdirMountPath = "/userdir"

	// database paths
	dbMountPath = "/userdir/.orchest/database/data"
	dbSubPath   = ".orchest/database/data"

	// rabbitmq paths
	rabbitmountPath = "/var/lib/rabbitmq/mnesia"
	rabbitSubPath   = ".orchest/rabbitmq-mnesia"

	//Components
	orchestDatabase   = "orchest-database"
	orchestApi        = "orchest-api"
	orchestApiCleanup = "orchest-api-cleanup"
	rabbitmq          = "rabbitmq-server"
	celeryWorker      = "celery-worker"
	authServer        = "auth-server"
	orchestWebserver  = "orchest-webserver"
	nodeAgentName     = "node-agent"

	orderOfDeployment = []string{
		orchestDatabase,
		rabbitmq,
		celeryWorker,
		orchestApi,
		authServer,
		orchestWebserver,
		nodeAgentName,
	}

	//Labels and annotations
	GenerationKey         = "contoller.orchest.io/generation"
	ControllerLabelKey    = "controller.orchest.io"
	ControllerPartOfLabel = "contoller.orchest.io/part-of"
	DeploymentLabelKey    = "contoller.orchest.io/deployment"

	//Deployment spec
	Zero = intstr.FromInt(0)
)

type deployFunction func(context.Context, string, *orchestv1alpha1.OrchestCluster) error

type deployHandler struct {
	function    deployFunction
	updateEvent orchestv1alpha1.OrchestClusterEvent
	deployEvent orchestv1alpha1.OrchestClusterEvent
}

// OrchestReconciler reconciles a single OrchestCluster
type OrchestReconciler struct {
	key string

	name string

	namespace string

	controller *OrchestClusterController

	deploymentHandler map[string]deployHandler

	sleepTime time.Duration
}

func NewOrchestReconciler(key string,
	controller *OrchestClusterController) *OrchestReconciler {

	namespace, name, err := cache.SplitMetaNamespaceKey(key)
	if err != nil {
		return nil
	}
	reconciler := &OrchestReconciler{
		key:               key,
		name:              name,
		namespace:         namespace,
		controller:        controller,
		sleepTime:         time.Second,
		deploymentHandler: map[string]deployHandler{},
	}

	reconciler.deploymentHandler[orchestApi] = deployHandler{
		function:    reconciler.deployOrchestApi,
		updateEvent: orchestv1alpha1.UpgradingOrchestApi,
		deployEvent: orchestv1alpha1.DeployingOrchestApi,
	}

	reconciler.deploymentHandler[orchestDatabase] = deployHandler{
		function:    reconciler.deployOrchestDatabase,
		updateEvent: orchestv1alpha1.UpgradingOrchestDatabase,
		deployEvent: orchestv1alpha1.DeployingOrchestDatabase,
	}

	reconciler.deploymentHandler[authServer] = deployHandler{
		function:    reconciler.deployAuthServer,
		updateEvent: orchestv1alpha1.UpgradingAuthServer,
		deployEvent: orchestv1alpha1.DeployingAuthServer,
	}

	reconciler.deploymentHandler[celeryWorker] = deployHandler{
		function:    reconciler.deployCeleryWorker,
		updateEvent: orchestv1alpha1.UpgradingCeleryWorker,
		deployEvent: orchestv1alpha1.DeployingCeleryWorker,
	}

	reconciler.deploymentHandler[rabbitmq] = deployHandler{
		function:    reconciler.deployRabbitmq,
		updateEvent: orchestv1alpha1.UpgradingRabbitmq,
		deployEvent: orchestv1alpha1.DeployingRabbitmq,
	}

	reconciler.deploymentHandler[orchestWebserver] = deployHandler{
		function:    reconciler.deployWebserver,
		updateEvent: orchestv1alpha1.UpgradingOrchestWebserver,
		deployEvent: orchestv1alpha1.DeployingOrchestWebserver,
	}

	reconciler.deploymentHandler[nodeAgentName] = deployHandler{
		function:    reconciler.deployNodeAgent,
		updateEvent: orchestv1alpha1.UpgradingNodeAgent,
		deployEvent: orchestv1alpha1.DeployingNodeAgent,
	}

	return reconciler
}

// Installs deployer if the config is changed
func (r *OrchestReconciler) Reconcile(ctx context.Context) (err error) {

	// First we need to retrive the latest version of OrchestCluster
	orchest, err := r.controller.oClient.OrchestV1alpha1().OrchestClusters(r.namespace).Get(ctx, r.name, metav1.GetOptions{})
	if err != nil {
		if kerrors.IsNotFound(err) {
			// OrchestCluster does not exist, return
			return nil
		}
		return err
	}

	nextPhase, endPhase := r.determineNextPhase(orchest)
	if nextPhase == endPhase {
		return
	}
	err = r.controller.updatePhase(ctx, orchest.Namespace, orchest.Name, nextPhase, "")
	defer func() {
		if err == nil {
			err = r.controller.updatePhase(ctx, orchest.Namespace, orchest.Name, endPhase, "")
		}
	}()
	if err != nil {
		return err
	}

	needPause, err := r.shouldPause(orchest)
	if err != nil {
		return err
	}
	// If needUpdate is true, and the oldHash is present, the cluster should be paused first
	if needPause {
		orchest, err = r.pauseOrchest(ctx, orchest)
		if err != nil {
			return errors.Wrapf(err, "failed to pause the cluster, cluster: %s", r.key)
		}
	}

	// If the cluster paused, return
	if orchest.Spec.Orchest.Pause != nil && *orchest.Spec.Orchest.Pause {
		return nil
	}

	generation := fmt.Sprint(orchest.Generation)

	err = r.ensureUserDir(ctx, generation, orchest)
	if err != nil {
		return errors.Wrapf(err, "failed to ensure %s pvc", userDirName)
	}

	err = r.ensureBuildCacheDir(ctx, generation, orchest)
	if err != nil {
		return errors.Wrapf(err, "failed to ensure %s pvc", builderDirName)
	}

	// get the current deployments and pause them (change their replica to 0)
	deployments, err := r.getDeployments(orchest)
	if err != nil {
		return err
	}

	// We have to check each deployment, and create/recreate or update if the manifest is changed
	for _, deploymentName := range orderOfDeployment {
		deployment, ok := deployments[deploymentName]
		// deployment does not exist, let't create it
		if !ok {
			handler, ok := r.deploymentHandler[deploymentName]
			if !ok {
				return errors.Wrapf(err, "failed to get deployment handler of %s", deploymentName)
			}
			err = r.controller.updateCondition(ctx, orchest.Namespace, orchest.Name, handler.deployEvent)
			if err != nil {
				klog.Error(err)
				return errors.Wrapf(err, "failed to update status while changing the state to DeployingOrchest")
			}

			err = handler.function(ctx, generation, orchest)
			if err != nil {
				return errors.Wrapf(err, "failed to deploy %s component", deploymentName)
			}
		} else {
			//Update the deployment
			if !isDeploymentUpdated(deployment, orchest.Generation) || isDeploymentPaused(deployment) {
				handler, ok := r.deploymentHandler[deploymentName]
				if !ok {
					return errors.Wrapf(err, "failed to get deployment handler of %s", deploymentName)
				}

				err = r.controller.updateCondition(ctx, orchest.Namespace, orchest.Name, handler.updateEvent)
				if err != nil {
					return errors.Wrapf(err, "failed to update status while changing the state to Upgrading")
				}

				err = handler.function(ctx, generation, orchest)
				if err != nil {
					return errors.Wrapf(err, "failed to update %s component", deploymentName)
				}
			}
		}
	}

	return err

}

func (r *OrchestReconciler) determineNextPhase(orchest *orchestv1alpha1.OrchestCluster) (
	orchestv1alpha1.OrchestClusterPhase, orchestv1alpha1.OrchestClusterPhase) {

	phase := orchest.Status.Phase
	endPhase := orchestv1alpha1.Running

	if *orchest.Spec.Orchest.Pause && orchest.Status.Phase != orchestv1alpha1.Paused {
		phase = orchestv1alpha1.Pausing
		endPhase = orchestv1alpha1.Paused
	} else if orchest.Status.Phase == orchestv1alpha1.DeployedThirdParties {
		phase = orchestv1alpha1.DeployingOrchest
	} else if orchest.Status.ObservedHash != computeHash(&orchest.Spec) {
		phase = orchestv1alpha1.Upgrading
	}

	// If restart key is present, next phase would be in restarting
	if _, ok := orchest.GetAnnotations()[RestartAnnotationKey]; ok {
		phase = orchestv1alpha1.Restarting
	}

	return phase, endPhase
}

func (r *OrchestReconciler) shouldPause(orchest *orchestv1alpha1.OrchestCluster) (bool, error) {

	// get the current deployments
	deployments, err := r.getDeployments(orchest)
	if err != nil {
		return false, err
	}

	// If the cluster is paused there is no need to pause it
	if orchest.Status.Phase == orchestv1alpha1.Paused {
		return false, nil
	}

	// If pause is true, the cluster should be paused
	if *orchest.Spec.Orchest.Pause {
		return true, nil
	}

	// If the cluster is in transient state, it should be paused
	if orchest.Status.Phase == orchestv1alpha1.Upgrading ||
		orchest.Status.Phase == orchestv1alpha1.Pausing {
		return true, nil
	}

	// If restart key is present, the cluster should be paused, after it is paused
	// the key will be removed
	if _, ok := orchest.GetAnnotations()[RestartAnnotationKey]; ok {
		return true, nil
	}

	for _, deployment := range deployments {
		if !isDeploymentUpdated(deployment, orchest.Generation) {
			return true, nil
		}
	}

	return false, nil

}

func (r *OrchestReconciler) pauseOrchest(ctx context.Context, orchest *orchestv1alpha1.OrchestCluster) (*orchestv1alpha1.OrchestCluster,
	error) {

	// Check if the cleanup still in progress
	pod, err := r.controller.kClient.CoreV1().Pods(r.namespace).Get(ctx, orchestApiCleanup, metav1.GetOptions{})
	if err == nil {
		generation, ok := pod.Labels[ControllerRevisionHashLabelKey]

		// This is our cleanup pod, wait for it
		if ok && generation == fmt.Sprint(orchest.Generation) {
			err = r.waitForCleanupPod(ctx, r.namespace, orchestApiCleanup)
			if err != nil {
				return nil, err
			}
		}

		err = r.getKClient().CoreV1().Pods(r.namespace).Delete(ctx, orchestApiCleanup, metav1.DeleteOptions{})
		if err != nil {
			return nil, err
		}

	} else if err != nil && !kerrors.IsNotFound(err) {
		return nil, err
	}

	// get the current deployments and node-agent and pause them (change their replica to 0)
	deployments, err := r.getDeployments(orchest)
	if err != nil {
		return nil, err
	}

	_, err = r.getKClient().AppsV1().DaemonSets(orchest.Namespace).Get(ctx, nodeAgentName, metav1.GetOptions{})
	if err != nil && !kerrors.IsNotFound(err) {
		return nil, err
	}

	// Delete the node-agent
	if err == nil {
		err = r.getKClient().AppsV1().DaemonSets(orchest.Namespace).Delete(ctx, nodeAgentName, metav1.DeleteOptions{})
		if err != nil {
			return nil, err
		}
	}

	// There is no deployment, return early
	if len(deployments) == 0 {
		return orchest, nil
	}

	deploymentsToPause := make([]*appsv1.Deployment, 0, len(deployments))

	_, restartExist := orchest.Annotations[RestartAnnotationKey]

	var pauseReason string
	if orchest.Spec.Orchest.Pause != nil && *orchest.Spec.Orchest.Pause {
		pauseReason = PauseReasonOrchestPaused
	}
	if restartExist {
		pauseReason = PauseReasonRestartAnnotation
	}

	// the deployments should be stopped in reverse order
	for i := len(orderOfDeployment) - 1; i >= 0; i-- {

		deployment, ok := deployments[orderOfDeployment[i]]
		// deployment exist, we need to scale it down
		if ok {
			// Deployment is already paused, continue
			if isDeploymentPaused(deployment) {
				continue
			}

			// Deployment exist, but it is already updated, and the restart key is not present
			if isDeploymentUpdated(deployment, orchest.Generation) && !restartExist {
				continue
			}

			deploymentsToPause = append(deploymentsToPause, deployment)
		}
	}

	if len(deploymentsToPause) > 0 {

		for _, deployment := range deploymentsToPause {
			err = r.controller.updateCondition(ctx, orchest.Namespace, orchest.Name,
				orchestv1alpha1.OrchestClusterEvent(fmt.Sprintf("Pausing %s", deployment.Name)))
			if err != nil {
				return orchest, errors.Wrapf(err, "failed to update status while pausing %s", deployment.Name)
			}
			pauseDeployment(ctx, r.getKClient(), pauseReason, orchest.Generation, deployment)

			err = r.controller.updateCondition(ctx, orchest.Namespace, orchest.Name,
				orchestv1alpha1.OrchestClusterEvent(fmt.Sprintf("Paused %s", deployment.Name)))
			if err != nil {
				return nil, errors.Wrapf(err, "failed to update status after pausing %s", deployment.Name)
			}

			// we need to cleanup after orchest-api is paused
			if deployment.Name == orchestApi {
				err := r.cleanup(ctx, orchest)
				if err != nil {
					return nil, errors.Wrapf(err, "failed to cleanup OrchestCluster")
				}
				err = r.getKClient().CoreV1().Pods(r.namespace).Delete(ctx, orchestApiCleanup, metav1.DeleteOptions{})
				if err != nil {
					return nil, err
				}
			}
		}
	}

	// The cluster is paused, remove the restart annotation if present
	if _, ok := orchest.Annotations[RestartAnnotationKey]; ok {
		err := RemoveOrchestAnnotation(r.controller.oClient, r.name, r.namespace, RestartAnnotationKey)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to remove RestartAnnotationKey from OrchestCluster")
		}
	}

	return orchest, nil
}

// gets the deployments accociated with OrchestCluster and returns a map of them
func (r *OrchestReconciler) getDeployments(orchest *orchestv1alpha1.OrchestCluster) (
	map[string]*appsv1.Deployment, error) {

	// get the current deployments and pause them (change their replica to 0)
	selector, err := getDeploymentsSelector(orchest)
	if err != nil {
		return nil, err
	}

	deployments, err := r.controller.depLister.Deployments(r.namespace).List(selector)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get deployments of OrchestCluser=%s", orchest.Name)
	}

	// now we iterate over the list of deployments and create the map
	deploymentMap := make(map[string]*appsv1.Deployment, len(deployments))
	for _, deployment := range deployments {
		deploymentMap[deployment.Name] = deployment
	}

	return deploymentMap, nil
}

func (r *OrchestReconciler) ensureUserDir(ctx context.Context, curHash string, orchest *orchestv1alpha1.OrchestCluster) error {
	storageClass := orchest.Spec.Orchest.Resources.StorageClassName
	size := orchest.Spec.Orchest.Resources.UserDirVolumeSize

	// Retrive the created pvcs
	_, err := r.controller.kClient.CoreV1().PersistentVolumeClaims(r.namespace).Get(ctx, userDirName, metav1.GetOptions{})
	// userdir is not created or is removed, we have to recreate it
	if err != nil && kerrors.IsNotFound(err) {
		uaerDir := r.persistentVolumeClaim(userDirName, r.namespace, storageClass, size, curHash, orchest)
		_, err := r.controller.kClient.CoreV1().PersistentVolumeClaims(r.namespace).Create(ctx, uaerDir, metav1.CreateOptions{})
		if err != nil {
			return errors.Wrapf(err, "failed to create %s pvc", userDirName)
		}
		return nil
	}

	// TODO: create a new userdir, move the data from old userdir to new one and delete the old one

	return nil
}

func (r *OrchestReconciler) ensureBuildCacheDir(ctx context.Context, curHash string, orchest *orchestv1alpha1.OrchestCluster) error {
	storageClass := orchest.Spec.Orchest.Resources.StorageClassName
	size := orchest.Spec.Orchest.Resources.BuilderCacheDirVolumeSize

	// Retrive the created pvcs
	_, err := r.controller.kClient.CoreV1().PersistentVolumeClaims(r.namespace).Get(ctx, builderDirName, metav1.GetOptions{})
	// userdir is not created or is removed, we have to recreate it
	if err != nil && kerrors.IsNotFound(err) {
		buildDir := r.persistentVolumeClaim(builderDirName, r.namespace, storageClass, size, curHash, orchest)
		_, err := r.controller.kClient.CoreV1().PersistentVolumeClaims(r.namespace).Create(ctx, buildDir, metav1.CreateOptions{})
		if err != nil {
			return errors.Wrapf(err, "failed to create %s pvc", builderDirName)
		}
	}

	// TODO: create a new userdir, move the data from old userdir to new one and delete the old one
	return nil
}

func (d *OrchestReconciler) persistentVolumeClaim(name, namespace, storageClass string,
	volumeSize, hash string, orchest *orchestv1alpha1.OrchestCluster) *corev1.PersistentVolumeClaim {

	spec := corev1.PersistentVolumeClaimSpec{
		AccessModes: []corev1.PersistentVolumeAccessMode{corev1.ReadWriteMany},
		Resources: corev1.ResourceRequirements{
			Requests: corev1.ResourceList{
				corev1.ResourceName(corev1.ResourceStorage): resource.MustParse(volumeSize),
			},
		},
	}

	if storageClass != "" {
		spec.StorageClassName = &storageClass
	}

	pvc := &corev1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
			Labels: map[string]string{
				ControllerRevisionHashLabelKey: hash,
			},
			OwnerReferences: []metav1.OwnerReference{{
				APIVersion:         OrchestClusterVersion,
				Kind:               OrchestClusterKind,
				Name:               orchest.Name,
				UID:                orchest.UID,
				Controller:         &isController,
				BlockOwnerDeletion: &blockOwnerDeletion,
			}},
		},
		Spec: spec,
	}

	return pvc
}

func (r *OrchestReconciler) upsertObject(ctx context.Context, object client.Object) error {

	err := r.getGeneralClient().Create(ctx, object, &client.CreateOptions{})
	if err != nil && !kerrors.IsAlreadyExists(err) {
		return errors.Wrapf(err, "failed to create object %v", object)
	}

	if err == nil {
		return nil
	}

	oldObj := utils.GetInstanceOfObj(object)
	err = r.getGeneralClient().Get(ctx, client.ObjectKeyFromObject(object), oldObj)
	if err != nil {
		return errors.Wrapf(err, "failed to get the object %v", object)
	}

	if reflect.DeepEqual(oldObj, object) {
		return nil
	}

	patchData, err := utils.GetPatchData(oldObj, object)
	if err != nil {
		return nil
	}

	patch := client.RawPatch(types.StrategicMergePatchType, patchData)

	err = r.getGeneralClient().Patch(ctx, oldObj, patch)
	if err != nil {
		return errors.Wrapf(err, "failed to patch the object %v", object)
	}

	return nil
}

func (r *OrchestReconciler) deployOrchestDatabase(ctx context.Context, hash string, orchest *orchestv1alpha1.OrchestCluster) error {

	objects := getOrchetDatabaseManifests(hash, orchest)
	for _, obj := range objects {
		err := r.upsertObject(ctx, obj)
		if err != nil {
			return err
		}
	}

	return r.waitForDeployment(ctx, r.namespace, orchestDatabase)
}

func (r *OrchestReconciler) deployAuthServer(ctx context.Context, hash string, orchest *orchestv1alpha1.OrchestCluster) error {

	objects := getAuthServerManifests(hash, orchest)
	for _, obj := range objects {
		err := r.upsertObject(ctx, obj)
		if err != nil {
			return err
		}
	}

	return r.waitForDeployment(ctx, r.namespace, authServer)
}

func (r *OrchestReconciler) deployOrchestApi(ctx context.Context, hash string, orchest *orchestv1alpha1.OrchestCluster) error {

	objects := getOrchestApiManifests(hash, orchest)
	for _, obj := range objects {
		err := r.upsertObject(ctx, obj)
		if err != nil {
			return err
		}
	}

	return r.waitForDeployment(ctx, r.namespace, orchestApi)
}

func (r *OrchestReconciler) deployCeleryWorker(ctx context.Context, hash string, orchest *orchestv1alpha1.OrchestCluster) error {

	objects := getCeleryWorkerManifests(hash, orchest)
	for _, obj := range objects {
		err := r.upsertObject(ctx, obj)
		if err != nil {
			return err
		}
	}

	return r.waitForDeployment(ctx, r.namespace, celeryWorker)
}

func (r *OrchestReconciler) deployWebserver(ctx context.Context, hash string, orchest *orchestv1alpha1.OrchestCluster) error {

	objects := getOrchetWebserverManifests(hash, orchest)
	for _, obj := range objects {
		err := r.upsertObject(ctx, obj)
		if err != nil {
			return err
		}
	}

	return r.waitForDeployment(ctx, r.namespace, orchestWebserver)
}

func (r *OrchestReconciler) deployRabbitmq(ctx context.Context, hash string, orchest *orchestv1alpha1.OrchestCluster) error {

	objects := getRabbitMqManifests(hash, orchest)
	for _, obj := range objects {
		err := r.upsertObject(ctx, obj)
		if err != nil {
			return err
		}
	}

	return r.waitForDeployment(ctx, r.namespace, rabbitmq)
}

func (r *OrchestReconciler) deployNodeAgent(ctx context.Context, hash string, orchest *orchestv1alpha1.OrchestCluster) error {

	objects := getNodeAgentManifests(hash, orchest)
	for _, obj := range objects {
		err := r.upsertObject(ctx, obj)
		if err != nil {
			return err
		}
	}

	return nil
}

func (r *OrchestReconciler) cleanup(ctx context.Context, orchest *orchestv1alpha1.OrchestCluster) error {

	objects := getCleanupManifests(orchest)
	for _, obj := range objects {
		err := r.upsertObject(ctx, obj)
		if err != nil {
			return err
		}
	}

	return r.waitForCleanupPod(ctx, r.namespace, orchestApiCleanup)

}

func (r *OrchestReconciler) waitForCleanupPod(ctx context.Context, namespace, name string) error {
	klog.V(2).Infof("Waiting for pod to become Succeed or faild object key: %s/%s", namespace, name)

	retryMax := 30
	for retryCount := 0; retryCount < retryMax; retryCount++ {
		retryCount++
		if retryCount > retryMax {
			return errors.Errorf("exceeded max retry count waiting for pod to become succeed %s", name)
		}

		if retryCount > 1 {
			// only sleep after the first time
			<-time.After(r.sleepTime)
		}

		if !utils.IsPodActive(ctx, r.getKClient(), name, r.namespace) {
			klog.V(2).Infof("pod is succeeded. object key : %s/%s", name, namespace)
			return nil
		}

		klog.V(2).Infof("Pod %s is not succeeded, trying again.", name)
	}

	return errors.Errorf("exceeded max retry count waiting for pod to succeed %s", name)
}

func (r *OrchestReconciler) waitForDeployment(ctx context.Context, namespace, name string) error {
	klog.V(2).Infof("Waiting for deployment to become ready object key: %s/%s", namespace, name)

	// wait for deployment to become ready
	retryMax := 30
	for retryCount := 0; retryCount < retryMax; retryCount++ {
		if retryCount > 1 {
			// only sleep after the first time
			<-time.After(r.sleepTime)
		}

		if utils.IsDeploymentReady(ctx, r.getKClient(), name, r.namespace) {
			klog.V(2).Infof("Deployment is ready. object key : %s/%s", name, namespace)
			return nil
		}

		klog.V(2).Infof("Deployment %s is not ready, trying again.", name)
	}

	return errors.Errorf("exceeded max retry count waiting for deployment to become ready %s", name)
}

func (r *OrchestReconciler) getKClient() kubernetes.Interface {
	return r.controller.kClient
}

func (r *OrchestReconciler) getOClient() versioned.Interface {
	return r.controller.oClient
}

func (r *OrchestReconciler) getGeneralClient() client.Client {
	return r.controller.gClient
}
