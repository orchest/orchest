package orchestcluster

import (
	"context"
	"time"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	"github.com/pkg/errors"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	v1 "k8s.io/api/core/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/client-go/tools/cache"
	"k8s.io/klog/v2"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

var (

	// values used to created underlying resources
	isController       = true
	blockOwnerDeletion = true

	userDirName    = "userdir-pvc"
	configDirName  = "config-pvc"
	builderDirName = "image-builder-cache-pvc"

	userdirMountPath   = "/userdir"
	configdirMountPath = "/config"

	// database paths
	dbMountPath = "/userdir/.orchest/database/data"
	dbSubPath   = ".orchest/database/data"

	// rabbitmq paths
	rabbitmountPath = "/var/lib/rabbitmq/mnesia"
	rabbitSubPath   = ".orchest/rabbitmq-mnesia"

	//Components
	orchestDBName    = "orchest-database"
	orchestApiName   = "orchest-api"
	rabbitmqName     = "rabbitmq-server"
	celeryWorkerName = "celery-worker"
	authServerName   = "auth-server"
	orchestWebserver = "orchest-webserver"

	//Labels and annotations
	GenerationKey         = "contoller.orchest.io/generation"
	ControllerLabelKey    = "controller.orchest.io"
	ControllerPartOfLabel = "contoller.orchest.io/part-of"
	ComponentLabelKey     = "contoller.orchest.io/component"

	//Deployment spec
	Zero = intstr.FromInt(0)
)

// OrchestReconciler reconciles a single OrchestCluster
type OrchestReconciler struct {
	key string

	name string

	namespace string

	controller *OrchestClusterController

	sleepTime time.Duration
}

func NewOrchestReconciler(key string,
	controller *OrchestClusterController) *OrchestReconciler {

	namespace, name, err := cache.SplitMetaNamespaceKey(key)
	if err != nil {
		return nil
	}
	return &OrchestReconciler{
		key:        key,
		name:       name,
		namespace:  namespace,
		controller: controller,
		sleepTime:  time.Second,
	}
}

// Installs deployer if the config is changed
func (r *OrchestReconciler) Reconcile(ctx context.Context) error {

	// First we need to retrive the latest version of OrchestCluster
	orchest, err := r.controller.ocClient.OrchestV1alpha1().OrchestClusters(r.namespace).Get(ctx, r.name, metav1.GetOptions{})
	if err != nil {
		if kerrors.IsNotFound(err) {
			// OrchestCluster does not exist, return
			return nil
		}
		return err
	}

	// computer the hash of current version.
	curHash := ComputeHash(&orchest.Spec)

	// retrive the hash of current object
	oldHash, ok := orchest.GetLabels()[ControllerLabelKey]

	needUpdate := curHash != oldHash

	// If the update is needed, and needUpdate is true, the cluster should be paused first
	if needUpdate && ok && !r.isPaused(orchest) {
		r.pauseOrchest(orchest)
	}

	if curHash == oldHash {

	}

	// Retrive the created pvcs

	userdir, err := r.controller.client.CoreV1().PersistentVolumeClaims(r.namespace).Get(ctx, userDirName, metav1.GetOptions{})
	// userdir is not created or is removed, we have to recreate it
	if err != nil && kerrors.IsNotFound(err) {
		err := r.persistentVolumeClaim(userDirName, r.namespace, storageClass, userDirSize, orchest)
		if err != nil && !kerrors.IsAlreadyExists(err) {
			return errors.Wrapf(err, "failed to create %s pvc", userDirName)
		}
	}

	// Let's create required pvcs for orchest deployment
	storageClass := orchest.Spec.Orchest.Resources.StorageClassName

	userDirSize := orchest.Spec.Orchest.Resources.UserDirVolumeSize
	configDirSize := orchest.Spec.Orchest.Resources.ConfigDirVolumeSize
	builderDirSize := orchest.Spec.Orchest.Resources.BuilderCacheDirVolumeSize

	err := d.createPersistentVolumeClaim(ctx, userDirName, namespace, storageClass, userDirSize, orchest)
	if err != nil && !kerrors.IsAlreadyExists(err) {
		return errors.Wrapf(err, "failed to create %s pvc", userDirName)
	}

	err = d.createPersistentVolumeClaim(ctx, configDirName, namespace, storageClass, configDirSize, orchest)
	if err != nil && !kerrors.IsAlreadyExists(err) {
		return errors.Wrapf(err, "failed to create %s pvc", configDirName)
	}

	err = d.createPersistentVolumeClaim(ctx, builderDirName, namespace, storageClass, builderDirSize, orchest)
	if err != nil && !kerrors.IsAlreadyExists(err) {
		return errors.Wrapf(err, "failed to create %s pvc", builderDirName)
	}

	// The first component that should be deployed is orchest-database, becuase most of other components rely on it
	err = d.deployOrchestDatabase(ctx, orchest)
	if err != nil && !kerrors.IsAlreadyExists(err) {
		return errors.Wrapf(err, "failed to create %s deployment", orchestDBName)
	}

	// Rabbitmq has to be deployed next
	err = d.deployRabbitMq(ctx, orchest)
	if err != nil && !kerrors.IsAlreadyExists(err) {
		return errors.Wrapf(err, "failed to create %s deployment", rabbitmqName)
	}

	// celery-worker has to be deployed next
	err = d.deployCeleryWorker(ctx, orchest)
	if err != nil && !kerrors.IsAlreadyExists(err) {
		return errors.Wrapf(err, "failed to create %s deployment", celeryWorkerName)
	}

	// deploying auth-server
	err = d.deployAuthServer(ctx, orchest)
	if err != nil && !kerrors.IsAlreadyExists(err) {
		return errors.Wrapf(err, "failed to create %s deployment", authServerName)
	}

	// The next component would orchest-api
	err = d.deployOrchestApi(ctx, orchest)
	if err != nil && !kerrors.IsAlreadyExists(err) {
		return errors.Wrapf(err, "failed to create %s deployment", orchestApiName)
	}

	return nil

}

func (r *OrchestReconciler) isPaused(orchest *orchestv1alpha1.OrchestCluster) bool {
	return orchest.Status != nil &&
		(orchest.Status.State != orchestv1alpha1.Paused ||
			orchest.Status.State != orchestv1alpha1.Updating)
}

func (r *OrchestReconciler) pauseOrchest(ctx context.Context, orchest *orchestv1alpha1.OrchestCluster) error {

	orchest, err := r.controller.updateClusterStatus(ctx, orchest, orchestv1alpha1.Pausing, "Pausing the cluster")
	if err != nil {
		return errors.Wrapf(err, "failed to update status while changin the state to pausing")
	}

	// get the current deployments and pause them (change their replica to 0)
	deployments, err := r.getDeployments(ctx, orchest)
	if err != nil {
		return err
	}

	// orchest-webserver will be paused first
	webserver, ok := deployments[orchestWebserver]
	if ok {
		r.pauseOrchestWebserver(webserver)
	}

	return nil
}

// gets the deployments accociated with OrchestCluster and returns a map of them
func (r *OrchestReconciler) getDeployments(ctx context.Context, orchest *orchestv1alpha1.OrchestCluster) (
	map[string]*appsv1.Deployment, error) {

	orchest, err := r.controller.updateClusterStatus(ctx, orchest, orchestv1alpha1.Pausing, "Pausing the cluster")
	if err != nil {
		return nil, errors.Wrapf(err, "failed to update status while changin the state to pausing")
	}

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

// Uninstall the addon
func (d *OrchestReconciler) Uninstall(ctx context.Context, namespace string) error {
	return nil
}

func (d *OrchestReconciler) persistentVolumeClaim(name, namespace, storageClass string,
	volumeSize string, orchest *orchestv1alpha1.OrchestCluster) *v1.PersistentVolumeClaim {

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
			OwnerReferences: []metav1.OwnerReference{{
				APIVersion:         orchest.APIVersion,
				Kind:               orchest.Kind,
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

func (d *OrchestReconciler) deployOrchestDatabase(ctx context.Context, orchest *orchestv1alpha1.OrchestCluster) error {

	// First check if the deployment already exist

	deployment := getOrchetDatabaseManifest(orchest)
	service := getServiceManifest(orchestDBName, 5432, orchest)

	err := d.client.Create(ctx, deployment, &client.CreateOptions{})
	if err != nil && !kerrors.IsAlreadyExists(err) {
		return errors.Wrapf(err, "failed to create deployment")
	}

	err = d.client.Create(ctx, service, &client.CreateOptions{})
	if err != nil && !kerrors.IsAlreadyExists(err) {
		return errors.Wrapf(err, "failed to create service")
	}

	return d.waitForDeployment(ctx, client.ObjectKeyFromObject(deployment))
}

func (d *OrchestReconciler) deployAuthServer(ctx context.Context, orchest *orchestv1alpha1.OrchestCluster) error {

	deployment := d.getAuthServerManifest(orchest)
	service := getServiceManifest(authServerName, 80, orchest)

	err := d.client.Create(ctx, deployment.DeepCopy(), &client.CreateOptions{})
	if err != nil && !kerrors.IsAlreadyExists(err) {
		return errors.Wrapf(err, "failed to create deployment")
	}

	err = d.client.Create(ctx, service.DeepCopy(), &client.CreateOptions{})
	if err != nil && !kerrors.IsAlreadyExists(err) {
		return errors.Wrapf(err, "failed to create service")
	}

	return d.waitForDeployment(ctx, client.ObjectKeyFromObject(deployment))
}

func (d *OrchestReconciler) deployOrchestApi(ctx context.Context, orchest *orchestv1alpha1.OrchestCluster) error {

	deployment, rbacs := d.getOrchetApiManifest(orchest)
	service := getServiceManifest(orchestApiName, 80, orchest)

	for _, rbac := range rbacs {
		err := d.client.Create(ctx, rbac, &client.CreateOptions{})
		if err != nil && !kerrors.IsAlreadyExists(err) {
			return errors.Wrapf(err, "failed to create rbac manifest")
		}
	}

	err := d.client.Create(ctx, deployment, &client.CreateOptions{})
	if err != nil && !kerrors.IsAlreadyExists(err) {
		return errors.Wrapf(err, "failed to create deployment")
	}

	err = d.client.Create(ctx, service, &client.CreateOptions{})
	if err != nil && !kerrors.IsAlreadyExists(err) {
		return errors.Wrapf(err, "failed to create service")
	}

	return d.waitForDeployment(ctx, client.ObjectKeyFromObject(deployment))
}

func (d *OrchestReconciler) deployCeleryWorker(ctx context.Context, orchest *orchestv1alpha1.OrchestCluster) error {

	deployment, rbacs := d.getCeleryWorkerManifests(orchest)

	for _, rbac := range rbacs {
		err := d.client.Create(ctx, rbac, &client.CreateOptions{})
		if err != nil && !kerrors.IsAlreadyExists(err) {
			return errors.Wrapf(err, "failed to create rbac manifest")
		}
	}

	err := d.client.Create(ctx, deployment, &client.CreateOptions{})
	if err != nil && !kerrors.IsAlreadyExists(err) {
		return errors.Wrapf(err, "failed to create deployment manifest")
	}

	return d.waitForDeployment(ctx, client.ObjectKeyFromObject(deployment))
}

func (d *OrchestReconciler) deployRabbitMq(ctx context.Context, orchest *orchestv1alpha1.OrchestCluster) error {

	deployment := getRabbitMqManifest(orchest)
	service := getServiceManifest(rabbitmqName, 5672, orchest)

	err := d.client.Create(ctx, deployment.DeepCopy(), &client.CreateOptions{})
	if err != nil && !kerrors.IsAlreadyExists(err) {
		return errors.Wrapf(err, "failed to create deployment")
	}

	err = d.client.Create(ctx, service.DeepCopy(), &client.CreateOptions{})
	if err != nil && !kerrors.IsAlreadyExists(err) {
		return errors.Wrapf(err, "failed to create service")
	}

	return d.waitForDeployment(ctx, client.ObjectKeyFromObject(deployment))
}

func (d *OrchestReconciler) waitForDeployment(ctx context.Context, key client.ObjectKey) error {
	klog.Infof("Waiting for deployment to become ready object key: %s", key.String())

	// wait for deployment to become ready
	retryCount := 0
	retryMax := 30
	for {
		retryCount++
		if retryCount > retryMax {
			return errors.Errorf("exceeded max retry count waiting for deployment to become ready %s", key.String())
		}

		if retryCount > 1 {
			// only sleep after the first time
			<-time.After(d.sleepTime)
		}

		running, err := utils.RunningPodsForDeployment(ctx, d.client, key)
		if err != nil {
			klog.Infof("failed to query ready pods of deployment %s, trying again. %v", key.String(), err)
			continue
		}

		// Exit if all pods of the deployment are ready
		if running == 1 {
			break
		}
	}

	klog.Infof("Deployment is ready. object key : %s", key.String())

	return nil
}
