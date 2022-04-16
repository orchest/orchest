package orchestcluster

import (
	"context"
	"time"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/deployer"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	"github.com/pkg/errors"
	corev1 "k8s.io/api/core/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
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

	//Labels and annotations
	GenerationKey         = "contoller.orchest.io/generation"
	ControllerLabelKey    = "controller.orchest.io"
	ControllerPartOfLabel = "contoller.orchest.io/part-of"
	ComponentLabelKey     = "contoller.orchest.io/component"

	//Deployment spec
	Zero = intstr.FromInt(0)
)

type OrchestDeployer struct {
	client    client.Client
	config    *ControllerConfig
	name      string
	sleepTime time.Duration
}

func NewOrchestDeployer(name string, client client.Client, config *ControllerConfig) deployer.Deployer {
	return &OrchestDeployer{
		name:      name,
		client:    client,
		config:    config,
		sleepTime: time.Second,
	}
}

//returns the name of the deployer
func (d *OrchestDeployer) GetName() string {
	return d.name
}

// Installs deployer if the config is changed
func (d *OrchestDeployer) InstallIfChanged(ctx context.Context, namespace string, valuesStruct interface{}) error {

	orchest, ok := valuesStruct.(*orchestv1alpha1.OrchestCluster)
	if !ok {
		return errors.New("Wrong argument provided to orchest deployer")
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

// Uninstall the addon
func (d *OrchestDeployer) Uninstall(ctx context.Context, namespace string) error {
	return nil
}

func (d *OrchestDeployer) createPersistentVolumeClaim(ctx context.Context,
	name, namespace, storageClass, volumeSize string,
	orchest *orchestv1alpha1.OrchestCluster) error {

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

	return d.client.Create(ctx, pvc, &client.CreateOptions{})
}

func (d *OrchestDeployer) deployOrchestDatabase(ctx context.Context, orchest *orchestv1alpha1.OrchestCluster) error {

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

func (d *OrchestDeployer) deployAuthServer(ctx context.Context, orchest *orchestv1alpha1.OrchestCluster) error {

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

func (d *OrchestDeployer) deployOrchestApi(ctx context.Context, orchest *orchestv1alpha1.OrchestCluster) error {

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

func (d *OrchestDeployer) deployCeleryWorker(ctx context.Context, orchest *orchestv1alpha1.OrchestCluster) error {

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

func (d *OrchestDeployer) deployRabbitMq(ctx context.Context, orchest *orchestv1alpha1.OrchestCluster) error {

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

func (d *OrchestDeployer) waitForDeployment(ctx context.Context, key client.ObjectKey) error {
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
