package orchestcluster

import (
	"context"
	"fmt"
	"time"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	"github.com/pkg/errors"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"
	"k8s.io/klog/v2"
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
	orchestDatabase  = "orchest-database"
	orchestApi       = "orchest-api"
	rabbitmq         = "rabbitmq-server"
	celeryWorker     = "celery-worker"
	authServer       = "auth-server"
	orchestWebserver = "orchest-webserver"
	nodeAgentName    = "node-agent"

	orderOfDeployment = []string{
		orchestDatabase,
		rabbitmq,
		celeryWorker,
		authServer,
		orchestApi,
		orchestWebserver,
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

// OrchestReconciler reconciles a single OrchestCluster
type OrchestReconciler struct {
	key string

	name string

	namespace string

	controller *OrchestClusterController

	deploymentFunctions map[string]deployFunction

	sleepTime time.Duration
}

func NewOrchestReconciler(key string,
	controller *OrchestClusterController) *OrchestReconciler {

	namespace, name, err := cache.SplitMetaNamespaceKey(key)
	if err != nil {
		return nil
	}
	reconciler := &OrchestReconciler{
		key:                 key,
		name:                name,
		namespace:           namespace,
		controller:          controller,
		sleepTime:           time.Second,
		deploymentFunctions: map[string]deployFunction{},
	}

	reconciler.deploymentFunctions[orchestApi] = reconciler.deployOrchestApi
	reconciler.deploymentFunctions[orchestDatabase] = reconciler.deployOrchestDatabase
	reconciler.deploymentFunctions[authServer] = reconciler.deployAuthServer
	reconciler.deploymentFunctions[celeryWorker] = reconciler.deployCeleryWorker
	reconciler.deploymentFunctions[rabbitmq] = reconciler.deployRabbitmq
	reconciler.deploymentFunctions[orchestWebserver] = reconciler.deployWebserver

	return reconciler
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

	// compute the hash of current version.
	curHash := ComputeHash(&orchest.Spec)
	// retrive the hash of the reconciled object
	oldHash, ok := orchest.GetLabels()[ControllerLabelKey]

	needUpdate := curHash != oldHash

	// If needUpdate is true, and the oldHash is present, the cluster should be paused first
	if needUpdate && ok && !r.isPaused(orchest) {
		orchest, err = r.pauseOrchest(ctx, orchest)
		if err != nil {
			return errors.Wrapf(err, "failed to pause the cluster, cluster: %s", r.key)
		}
	}

	err = r.ensureUserDir(ctx, curHash, orchest)
	if err != nil {
		return errors.Wrapf(err, "failed to ensure %s pvc", userDirName)
	}

	err = r.ensureBuildCacheDir(ctx, curHash, orchest)
	if err != nil {
		return errors.Wrapf(err, "failed to ensure %s pvc", userDirName)
	}

	// get the current deployments and pause them (change their replica to 0)
	deployments, err := r.getDeployments(ctx, orchest)
	if err != nil {
		return err
	}

	// We have to check each deployment, and create/recreate or update if the manifest is changed
	for _, deploymentName := range orderOfDeployment {
		deployment, ok := deployments[deploymentName]
		// deployment does not exist, let't create it
		if !ok {
			orchest, err := r.controller.updateClusterStatus(ctx, orchest,
				orchestv1alpha1.DeployingOrchest,
				fmt.Sprintf("Deploying %s", deploymentName))

			if err != nil {
				klog.Error(err)
				return errors.Wrapf(err, "failed to update status while changing the state to DeployingOrchest")
			}

			err = r.deploymentFunctions[deploymentName](ctx, curHash, orchest)
			if err != nil {
				return errors.Wrapf(err, "failed to deploy %s component", deploymentName)
			}

			/*
				orchest, err = r.controller.updateClusterStatus(ctx, orchest,
					orchestv1alpha1.DeployingOrchest,
					fmt.Sprintf("Deployed %s", deploymentName))

				// It's minor error, we will move on
				if err != nil {
					klog.Warning("failed to update state to DeployingOrchest")
				}
			*/
		} else {
			depHash := deployment.GetLabels()[ControllerRevisionHashLabelKey]
			//Update the deployment
			if depHash != curHash {
				orchest, err := r.controller.updateClusterStatus(ctx, orchest,
					orchestv1alpha1.Updating,
					fmt.Sprintf("Updating %s", deploymentName))

				if err != nil {
					return errors.Wrapf(err, "failed to update status while changing the state to Updating")
				}

				err = r.deploymentFunctions[deploymentName](ctx, curHash, orchest)
				if err != nil {
					return errors.Wrapf(err, "failed to update %s component", deploymentName)
				}

				orchest, err = r.controller.updateClusterStatus(ctx, orchest,
					orchestv1alpha1.Updating,
					fmt.Sprintf("Updated %s", deploymentName))

				// It's minor error, we will move on
				if err != nil {
					klog.Warning("failed to update state to Updating")
				}
			}
		}

	}

	return nil

}

func (r *OrchestReconciler) isPaused(orchest *orchestv1alpha1.OrchestCluster) bool {
	return orchest.Status != nil &&
		(orchest.Status.State != orchestv1alpha1.Paused ||
			orchest.Status.State != orchestv1alpha1.Updating)
}

func (r *OrchestReconciler) pauseOrchest(ctx context.Context, orchest *orchestv1alpha1.OrchestCluster) (*orchestv1alpha1.OrchestCluster,
	error) {

	orchest, err := r.controller.updateClusterStatus(ctx, orchest, orchestv1alpha1.Pausing, "Pausing the cluster")
	if err != nil {
		return nil, errors.Wrapf(err, "failed to update status while changin the state to pausing")
	}

	// get the current deployments and pause them (change their replica to 0)
	deployments, err := r.getDeployments(ctx, orchest)
	if err != nil {
		return nil, err
	}

	// the deployments should be stopped in reverse order
	for i := len(orderOfDeployment) - 1; i >= 0; i-- {

		deployment, ok := deployments[orderOfDeployment[i]]
		// deployment exist, we need to scale it down
		if ok {
			orchest, err := r.controller.updateClusterStatus(ctx, orchest, orchestv1alpha1.Pausing, fmt.Sprintf("Pausing %s", deployment.Name))
			if err != nil {
				return orchest, errors.Wrapf(err, "failed to update status while pausing orchest-webserver")
			}
			utils.PauseDeployment(ctx, r.getClient(), deployment)

			orchest, err = r.controller.updateClusterStatus(ctx, orchest, orchestv1alpha1.Pausing, fmt.Sprintf("Paused %s", deployment.Name))
			if err != nil {
				return nil, errors.Wrapf(err, "failed to update status while pausing orchest-webserver")
			}
		}

	}

	orchest, err = r.controller.updateClusterStatus(ctx, orchest, orchestv1alpha1.Paused, "Paused the cluster")
	if err != nil {
		return nil, errors.Wrapf(err, "failed to update status while changin the state to pausing")
	}

	return orchest, nil
}

// gets the deployments accociated with OrchestCluster and returns a map of them
func (r *OrchestReconciler) getDeployments(ctx context.Context, orchest *orchestv1alpha1.OrchestCluster) (
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
	pvc, err := r.controller.client.CoreV1().PersistentVolumeClaims(r.namespace).Get(ctx, userDirName, metav1.GetOptions{})
	// userdir is not created or is removed, we have to recreate it
	if err != nil && kerrors.IsNotFound(err) {
		uaerDir := r.persistentVolumeClaim(userDirName, r.namespace, storageClass, size, curHash, orchest)
		_, err := r.controller.client.CoreV1().PersistentVolumeClaims(r.namespace).Create(ctx, uaerDir, metav1.CreateOptions{})
		if err != nil {
			return errors.Wrapf(err, "failed to create %s pvc", userDirName)
		}
		return nil
	}

	hash := pvc.GetLabels()[ControllerRevisionHashLabelKey]
	if hash != curHash {
		// TODO: create a new userdir, move the data from old userdir to new one and delete the old one
	}
	return nil
}

func (r *OrchestReconciler) ensureBuildCacheDir(ctx context.Context, curHash string, orchest *orchestv1alpha1.OrchestCluster) error {
	storageClass := orchest.Spec.Orchest.Resources.StorageClassName
	size := orchest.Spec.Orchest.Resources.BuilderCacheDirVolumeSize

	// Retrive the created pvcs
	pvc, err := r.controller.client.CoreV1().PersistentVolumeClaims(r.namespace).Get(ctx, builderDirName, metav1.GetOptions{})
	// userdir is not created or is removed, we have to recreate it
	if err != nil && kerrors.IsNotFound(err) {
		buildDir := r.persistentVolumeClaim(builderDirName, r.namespace, storageClass, size, curHash, orchest)
		_, err := r.controller.client.CoreV1().PersistentVolumeClaims(r.namespace).Create(ctx, buildDir, metav1.CreateOptions{})
		if err != nil {
			return errors.Wrapf(err, "failed to create %s pvc", builderDirName)
		}
	}

	hash := pvc.GetLabels()[ControllerRevisionHashLabelKey]
	if hash != curHash {
		// TODO: create a new userdir, move the data from old userdir to new one and delete the old one
	}
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

func (r *OrchestReconciler) upsertDeployment(ctx context.Context, hash string, deployment *appsv1.Deployment) error {

	storedDeployment, err := r.getClient().AppsV1().Deployments(r.namespace).Get(ctx, deployment.Name, metav1.GetOptions{})
	if err != nil && !kerrors.IsNotFound(err) {
		return errors.Wrapf(err, "failed to get the deployment")
	}

	if kerrors.IsNotFound(err) {
		_, err := r.getClient().AppsV1().Deployments(r.namespace).Create(ctx, deployment, metav1.CreateOptions{})
		if err != nil {
			return errors.Wrapf(err, "failed to create the deployment")
		}
	} else {
		deployedHash := storedDeployment.GetLabels()[ControllerRevisionHashLabelKey]
		if deployedHash != hash {
			storedDeployment.Spec = *deployment.Spec.DeepCopy()
			_, err := r.getClient().AppsV1().Deployments(r.namespace).Update(ctx, storedDeployment, metav1.UpdateOptions{})
			if err != nil {
				return errors.Wrapf(err, "failed to update the deployment")
			}
		}
	}

	return nil
}

func (r *OrchestReconciler) upsertService(ctx context.Context, hash string, service *corev1.Service) error {

	storedService, err := r.getClient().CoreV1().Services(r.namespace).Get(ctx, service.Name, metav1.GetOptions{})
	if err != nil && !kerrors.IsNotFound(err) {
		return errors.Wrapf(err, "failed to get the service")
	}

	if kerrors.IsNotFound(err) {
		_, err := r.getClient().CoreV1().Services(r.namespace).Create(ctx, service, metav1.CreateOptions{})
		if err != nil {
			return errors.Wrapf(err, "failed to create the service")
		}
	} else {
		deployedHash := storedService.GetLabels()[ControllerRevisionHashLabelKey]
		if deployedHash != hash {
			storedService.Spec = *service.Spec.DeepCopy()
			_, err := r.getClient().CoreV1().Services(r.namespace).Update(ctx, storedService, metav1.UpdateOptions{})
			if err != nil {
				return errors.Wrapf(err, "failed to update the service")
			}
		}
	}

	return nil
}

func (r *OrchestReconciler) upsertRbac(ctx context.Context, role *rbacv1.ClusterRole,
	roleBinding *rbacv1.ClusterRoleBinding, sa *corev1.ServiceAccount) error {

	_, err := r.getClient().RbacV1().ClusterRoles().Create(ctx, role, metav1.CreateOptions{})
	if err != nil && !kerrors.IsAlreadyExists(err) {
		return errors.Wrapf(err, "failed to create cluster role")
	}

	_, err = r.getClient().RbacV1().ClusterRoleBindings().Create(ctx, roleBinding, metav1.CreateOptions{})
	if err != nil && !kerrors.IsAlreadyExists(err) {
		return errors.Wrapf(err, "failed to create cluster role binding")
	}

	_, err = r.getClient().CoreV1().ServiceAccounts(r.namespace).Create(ctx, sa, metav1.CreateOptions{})
	if err != nil && !kerrors.IsAlreadyExists(err) {
		return errors.Wrapf(err, "failed to create service account")
	}

	return nil
}

func (r *OrchestReconciler) deployOrchestDatabase(ctx context.Context, hash string, orchest *orchestv1alpha1.OrchestCluster) error {

	deployment := getOrchetDatabaseManifest(hash, orchest)
	err := r.upsertDeployment(ctx, hash, deployment)
	if err != nil {
		return err
	}

	service := getServiceManifest(orchestDatabase, hash, 5432, orchest)
	err = r.upsertService(ctx, hash, service)
	if err != nil {
		return err
	}

	return r.waitForDeployment(ctx, r.namespace, orchestDatabase)
}

func (r *OrchestReconciler) deployAuthServer(ctx context.Context, hash string, orchest *orchestv1alpha1.OrchestCluster) error {

	deployment := getAuthServerManifest(hash, orchest)
	err := r.upsertDeployment(ctx, hash, deployment)
	if err != nil {
		return err
	}

	service := getServiceManifest(authServer, hash, 80, orchest)
	err = r.upsertService(ctx, hash, service)
	if err != nil {
		return err
	}

	return r.waitForDeployment(ctx, r.namespace, authServer)
}

func (r *OrchestReconciler) deployOrchestApi(ctx context.Context, hash string, orchest *orchestv1alpha1.OrchestCluster) error {

	deployment, role, roleBinding, sa := getOrchetApiManifest(hash, orchest)

	err := r.upsertRbac(ctx, role, roleBinding, sa)
	if err != nil {
		return err
	}

	err = r.upsertDeployment(ctx, hash, deployment)
	if err != nil {
		return err
	}

	service := getServiceManifest(orchestApi, hash, 80, orchest)
	err = r.upsertService(ctx, hash, service)
	if err != nil {
		return err
	}

	return r.waitForDeployment(ctx, r.namespace, orchestApi)
}

func (r *OrchestReconciler) deployCeleryWorker(ctx context.Context, hash string, orchest *orchestv1alpha1.OrchestCluster) error {

	deployment, role, roleBinding, sa := getCeleryWorkerManifests(hash, orchest)

	err := r.upsertRbac(ctx, role, roleBinding, sa)
	if err != nil {
		return err
	}

	err = r.upsertDeployment(ctx, hash, deployment)
	if err != nil {
		return err
	}

	return r.waitForDeployment(ctx, r.namespace, celeryWorker)
}

func (r *OrchestReconciler) deployWebserver(ctx context.Context, hash string, orchest *orchestv1alpha1.OrchestCluster) error {

	deployment := getOrchetWebserverManifest(hash, orchest)
	err := r.upsertDeployment(ctx, hash, deployment)
	if err != nil {
		return err
	}

	service := getServiceManifest(orchestWebserver, hash, 80, orchest)
	err = r.upsertService(ctx, hash, service)
	if err != nil {
		return err
	}

	return r.waitForDeployment(ctx, r.namespace, orchestWebserver)
}

func (r *OrchestReconciler) deployRabbitmq(ctx context.Context, hash string, orchest *orchestv1alpha1.OrchestCluster) error {

	deployment := getRabbitMqManifest(hash, orchest)
	err := r.upsertDeployment(ctx, hash, deployment)
	if err != nil {
		return err
	}

	service := getServiceManifest(rabbitmq, hash, 5672, orchest)
	err = r.upsertService(ctx, hash, service)
	if err != nil {
		return err
	}

	return r.waitForDeployment(ctx, r.namespace, rabbitmq)
}

func (r *OrchestReconciler) waitForDeployment(ctx context.Context, namespace, name string) error {
	klog.Infof("Waiting for deployment to become ready object key: %s/%s", namespace, name)

	// wait for deployment to become ready
	retryCount := 0
	retryMax := 30
	for {
		retryCount++
		if retryCount > retryMax {
			return errors.Errorf("exceeded max retry count waiting for deployment to become ready %s", name)
		}

		if retryCount > 1 {
			// only sleep after the first time
			<-time.After(r.sleepTime)
		}

		if utils.IsDeploymentReady(ctx, r.getClient(), name, r.namespace) {
			break
		}

		klog.Infof("Deployment %s is not ready, trying again.", name)
	}

	klog.Infof("Deployment is ready. object key : %s/%s", name, namespace)

	return nil
}

func (r *OrchestReconciler) getClient() kubernetes.Interface {
	return r.controller.client
}
