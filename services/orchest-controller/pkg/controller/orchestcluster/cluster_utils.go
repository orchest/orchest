package orchestcluster

import (
	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/certs"
	orchestlisters "github.com/orchest/orchest/services/orchest-controller/pkg/client/listers/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/controller"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/klog/v2"
)

var (
	orderOfDeployment = []string{
		controller.OrchestDatabase,
		controller.OrchestApi,
		controller.Rabbitmq,
		controller.CeleryWorker,
		controller.AuthServer,
		controller.OrchestWebserver,
		controller.NodeAgent,
	}
)

// This function is borrowed from projectcountour
func registryCertgen(ctx context.Context,
	client kubernetes.Interface,
	orchest *orchestv1alpha1.OrchestCluster) error {
	generatedCerts, err := certs.GenerateCerts(
		&certs.Configuration{
			Lifetime:  365,
			Namespace: orchest.Namespace,
		})
	if err != nil {
		klog.Error("failed to generate certificates")
		return err
	}

	owner := *metav1.NewControllerRef(orchest, OrchestClusterKind)

	if err := utils.OutputCerts(ctx, orchest.Namespace, owner, client, generatedCerts); err != nil {
		klog.Errorf("failed output certificates, error: %v", err)
		return err
	}

	return nil
}

func getPersistentVolumeClaim(name, volumeSize, hash string,
	orchest *orchestv1alpha1.OrchestCluster) *corev1.PersistentVolumeClaim {

	metadata := controller.GetMetadata(name, hash, orchest, OrchestClusterKind)

	accessMode := corev1.ReadWriteMany
	if orchest.Spec.SingleNode {
		accessMode = corev1.ReadWriteOnce
	}

	spec := corev1.PersistentVolumeClaimSpec{
		AccessModes: []corev1.PersistentVolumeAccessMode{accessMode},
		Resources: corev1.ResourceRequirements{
			Requests: corev1.ResourceList{
				corev1.ResourceName(corev1.ResourceStorage): resource.MustParse(volumeSize),
			},
		},
	}

	if orchest.Spec.Orchest.Resources.StorageClassName != "" {
		spec.StorageClassName = &orchest.Spec.Orchest.Resources.StorageClassName
	}

	pvc := &corev1.PersistentVolumeClaim{
		ObjectMeta: metadata,
		Spec:       spec,
	}

	return pvc
}

func determineNextPhase(orchest *orchestv1alpha1.OrchestCluster) (
	orchestv1alpha1.OrchestPhase, orchestv1alpha1.OrchestPhase) {

	// Next phase is the phase the OrchestCluster will enter
	var nextPhase orchestv1alpha1.OrchestPhase

	// After nextPhase is finished, the OrchestCluster will enter endPhase
	var endPhase orchestv1alpha1.OrchestPhase

	// The current phase of the cluster
	curPhase := orchest.Status.Phase

	if !orchest.GetDeletionTimestamp().IsZero() {
		// If the cluster is removed, we enter deleting phase
		nextPhase = orchestv1alpha1.Deleting
	}
	if *orchest.Spec.Orchest.Pause && curPhase != orchestv1alpha1.Stopped {
		// If the cluster needs to be paused but not paused yet
		nextPhase = orchestv1alpha1.Stopping

		endPhase = orchestv1alpha1.Stopped

	} else if *orchest.Spec.Orchest.Pause && curPhase == orchestv1alpha1.Stopped {
		// If the cluster needs to be paused and already paused
		nextPhase = orchestv1alpha1.Stopped

		endPhase = orchestv1alpha1.Stopped

	} else if !*orchest.Spec.Orchest.Pause && curPhase == orchestv1alpha1.Stopped {
		// If cluster is stopped but the pause is false
		nextPhase = orchestv1alpha1.Starting

		endPhase = orchestv1alpha1.Running

	} else if (curPhase == orchestv1alpha1.Starting || curPhase == orchestv1alpha1.DeployingOrchest) &&
		(orchest.Status.ObservedHash == controller.ComputeHash(&orchest.Spec)) {
		// If cluster is starting, and the hash is not changed, then the next phase would be Starting again
		nextPhase = curPhase

		endPhase = orchestv1alpha1.Running
	} else if curPhase == orchestv1alpha1.DeployingThirdParties {
		// If the cluster is deploying third parties, it continue deploying, and
		// will enter deployed once finished
		nextPhase = curPhase

		endPhase = orchestv1alpha1.DeployedThirdParties

	} else if curPhase == orchestv1alpha1.DeployedThirdParties {
		nextPhase = orchestv1alpha1.DeployingOrchest

		endPhase = orchestv1alpha1.Running
	} else if orchest.Status.ObservedGeneration != orchest.Generation {
		// If the hash is changed, the cluster enters upgrading state and then running
		nextPhase = orchestv1alpha1.Updating

		endPhase = orchestv1alpha1.Running

	} else if _, ok := orchest.GetAnnotations()[controller.RestartAnnotationKey]; ok {
		// If restart annotation is present, cluster enters pausing phase then running
		nextPhase = orchestv1alpha1.Stopping

		endPhase = orchestv1alpha1.Stopped

	} else if curPhase == orchestv1alpha1.Stopping {
		// If we are here the restart annotation is removed so we need to enter starting phase
		nextPhase = orchestv1alpha1.Starting

		endPhase = orchestv1alpha1.Running
	} else {

		nextPhase = curPhase
		endPhase = orchestv1alpha1.Running
	}

	return nextPhase, endPhase
}

// GetOrchetComponents returns all the components of the OrchestCluster
func GetOrchetComponents(ctx context.Context,
	orchest *orchestv1alpha1.OrchestCluster,
	lister orchestlisters.OrchestComponentLister) (
	map[string]*orchestv1alpha1.OrchestComponent, error) {

	selector, err := controller.GetOrchestLabelSelector(orchest)
	if err != nil {
		return nil, err
	}

	// List the orchest components
	components, err := lister.OrchestComponents(orchest.Namespace).List(selector)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get components of OrchestCluser=%s", orchest.Name)
	}

	// now we iterate over the all the resources
	componentMap := make(map[string]*orchestv1alpha1.OrchestComponent, len(components))
	for _, component := range components {
		componentMap[component.Name] = component
	}

	return componentMap, nil
}

func GetComponentTemplate(name string, orchest *orchestv1alpha1.OrchestCluster) (
	*orchestv1alpha1.OrchestComponentTemplate, error) {
	var componentTemplate *orchestv1alpha1.OrchestComponentTemplate

	switch name {
	case controller.OrchestDatabase:
		componentTemplate = orchest.Spec.Postgres.DeepCopy()
	case controller.OrchestApi:
		componentTemplate = orchest.Spec.Orchest.OrchestApi.DeepCopy()
	case controller.Rabbitmq:
		componentTemplate = orchest.Spec.RabbitMq.DeepCopy()
	case controller.CeleryWorker:
		componentTemplate = orchest.Spec.Orchest.CeleryWorker.DeepCopy()
	case controller.AuthServer:
		componentTemplate = orchest.Spec.Orchest.AuthServer.DeepCopy()
	case controller.OrchestWebserver:
		componentTemplate = orchest.Spec.Orchest.OrchestWebServer.DeepCopy()
	case controller.NodeAgent:
		componentTemplate = orchest.Spec.Orchest.NodeAgent.DeepCopy()
	default:
		return nil, errors.Errorf("unrecognized component name %s", name)
	}

	return componentTemplate, nil
}

func getOrchestComponent(name, hash string,
	template *orchestv1alpha1.OrchestComponentTemplate,
	orchest *orchestv1alpha1.OrchestCluster) *orchestv1alpha1.OrchestComponent {

	metadata := controller.GetMetadata(name, hash, orchest, OrchestClusterKind)

	env := utils.MergeEnvVars(orchest.Spec.Orchest.Env, template.Env)
	template.Env = env

	return &orchestv1alpha1.OrchestComponent{
		ObjectMeta: metadata,
		Spec: orchestv1alpha1.OrchestComponentSpec{
			OrchestHost: orchest.Spec.Orchest.OrchestHost,
			Template:    *template,
		},
	}

}
