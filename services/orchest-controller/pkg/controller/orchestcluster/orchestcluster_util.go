package orchestcluster

import (
	"context"
	"fmt"
	"hash/fnv"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/client/clientset/versioned"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	"github.com/pkg/errors"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/util/rand"
	"k8s.io/client-go/kubernetes"
	"k8s.io/klog/v2"
)

func getDeploymentsSelector(orchest *orchestv1alpha1.OrchestCluster) (labels.Selector, error) {

	labels := getDeploymentsLabels(orchest)
	labelSelector := metav1.SetAsLabelSelector(labels)

	selector, err := metav1.LabelSelectorAsSelector(labelSelector)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get Selector from LabelSelector")
	}

	return selector, nil
}

func getDeploymentsLabels(orchest *orchestv1alpha1.OrchestCluster) map[string]string {
	labels := utils.DeepCopy(orchest.GetLabels())
	labels[ControllerLabelKey] = orchest.Name
	labels[ControllerPartOfLabel] = "orchest"
	return labels
}

func getMatchLables(deploymentName string, orchest *orchestv1alpha1.OrchestCluster) map[string]string {
	labels := getDeploymentsLabels(orchest)
	labels[deploymentName] = deploymentName
	return labels
}

func getMetadata(compoenentName, hash string, orchest *orchestv1alpha1.OrchestCluster) metav1.ObjectMeta {

	labels := getMatchLables(compoenentName, orchest)
	labels[ControllerRevisionHashLabelKey] = hash

	metadata := metav1.ObjectMeta{
		Name:        compoenentName,
		Namespace:   orchest.Namespace,
		Labels:      labels,
		Annotations: orchest.Annotations,
		OwnerReferences: []metav1.OwnerReference{{
			APIVersion:         OrchestClusterVersion,
			Kind:               OrchestClusterKind,
			Name:               orchest.Name,
			UID:                orchest.UID,
			Controller:         &isController,
			BlockOwnerDeletion: &blockOwnerDeletion,
		}},
	}

	return metadata
}

func getServiceManifest(compoenentName, hash string, port int, orchest *orchestv1alpha1.OrchestCluster) *corev1.Service {

	metadata := getMetadata(compoenentName, hash, orchest)
	matchLable := getMatchLables(compoenentName, orchest)

	service := &corev1.Service{
		ObjectMeta: metadata,
		Spec: corev1.ServiceSpec{
			Selector: matchLable,
			Ports: []corev1.ServicePort{
				{
					Port: int32(port),
				},
			},
		},
	}

	return service

}

func getRbacManifest(metadata metav1.ObjectMeta) (*rbacv1.ClusterRole, *rbacv1.ClusterRoleBinding, *corev1.ServiceAccount) {

	clusterRole := &rbacv1.ClusterRole{
		ObjectMeta: metadata,
		Rules: []rbacv1.PolicyRule{
			rbacv1.PolicyRule{
				APIGroups: []string{"*"},
				Resources: []string{"*"},
				Verbs:     []string{"*"},
			},
		},
	}

	clusterRoleBinding := &rbacv1.ClusterRoleBinding{
		ObjectMeta: metadata,
		Subjects: []rbacv1.Subject{
			{
				Kind:      "ServiceAccount",
				Name:      celeryWorker,
				Namespace: metadata.Namespace,
			},
		},
		RoleRef: rbacv1.RoleRef{
			APIGroup: "rbac.authorization.k8s.io",
			Name:     celeryWorker,
			Kind:     "ClusterRole",
		},
	}

	serviceAccount := &corev1.ServiceAccount{
		ObjectMeta: metadata,
	}

	return clusterRole, clusterRoleBinding, serviceAccount

}

// AddFinalizer adds specified finalizer string to object
func AddFinalizerIfNotPresent(ctx context.Context,
	ocClient versioned.Interface,
	orchest *orchestv1alpha1.OrchestCluster,
	finalizer string) (*orchestv1alpha1.OrchestCluster, error) {

	if utils.Contains(orchest.GetFinalizers(), finalizer) {
		return orchest, nil
	}

	klog.Infof("OrchestCluster does not have orchest finalzier, OrchestCluster: %s", orchest.GetName())
	orchest.SetFinalizers(append(orchest.GetFinalizers(), finalizer))

	result, err := ocClient.OrchestV1alpha1().OrchestClusters(orchest.Namespace).Update(ctx, orchest, metav1.UpdateOptions{})
	if err != nil {
		return nil, errors.Wrapf(err, "failed to add finalizer %q to %q", finalizer, orchest.GetName())
	}

	return result, nil
}

// RemoveFinalizers removes finalizersfrom object
func RemoveFinalizerIfNotPresent(ctx context.Context,
	ocClient versioned.Interface,
	orchest *orchestv1alpha1.OrchestCluster,
	finalizer string) error {

	finalizers := utils.Remove(orchest.GetFinalizers(), finalizer)
	orchest.SetFinalizers(finalizers)

	_, err := ocClient.OrchestV1alpha1().OrchestClusters(orchest.Namespace).Update(ctx, orchest, metav1.UpdateOptions{})
	if err != nil {
		return errors.Wrapf(err, "failed to remove finalizer %q from %q", finalizer, orchest.GetName())
	}

	return nil
}

func RemoveOrchestAnnotation(oClient versioned.Interface, name string, namespace string, key string) error {
	orchest, err := oClient.OrchestV1alpha1().OrchestClusters(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return err
	}
	delete(orchest.Annotations, key)

	_, err = oClient.OrchestV1alpha1().OrchestClusters(namespace).Update(context.Background(), orchest, metav1.UpdateOptions{})

	if err != nil {
		klog.Errorf("Failed to remove annotation: %s from OrchestCluster %s, error %v", key, orchest.Name, err)
		return err
	}

	return nil
}

func ComputeHash(spec *orchestv1alpha1.OrchestClusterSpec) string {
	hasher := fnv.New32a()
	utils.DeepHashObject(hasher, *spec)

	return rand.SafeEncodeString(fmt.Sprint(hasher.Sum32()))
}

func isDeploymentUpdated(dep *appsv1.Deployment, generation int64) bool {
	templateMatches := dep.Labels[ControllerRevisionHashLabelKey] == fmt.Sprint(generation)
	return templateMatches
}

func shouldUpdateDeployment(dep *appsv1.Deployment) bool {
	_, ok := dep.Annotations[PauseReasonAnnotationKey]
	return ok
}

func PauseDeployment(ctx context.Context,
	client kubernetes.Interface,
	pauseReason string,
	generation int64,
	deployment *appsv1.Deployment) error {

	ZeroReplica := int32(0)

	cloneDep := deployment.DeepCopy()
	cloneDep.Spec.Paused = true
	cloneDep.Annotations[PauseReasonAnnotationKey] = pauseReason
	cloneDep.Spec.Replicas = &ZeroReplica
	cloneDep.Labels[appsv1.ControllerRevisionHashLabelKey] = fmt.Sprint(generation)

	_, err := client.AppsV1().Deployments(deployment.Namespace).Update(ctx, cloneDep, metav1.UpdateOptions{})
	if err != nil {
		return errors.Wrapf(err, "failed to pause a deployment %s", deployment.Name)
	}

	return nil
}
