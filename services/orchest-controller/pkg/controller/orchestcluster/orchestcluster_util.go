package orchestcluster

import (
	"context"
	"fmt"
	"hash/fnv"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/client/clientset/versioned"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	"github.com/pkg/errors"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/util/rand"
	"k8s.io/klog/v2"
	"sigs.k8s.io/controller-runtime/pkg/client"
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

func getMetadata(compoenentName string, orchest *orchestv1alpha1.OrchestCluster) metav1.ObjectMeta {

	metadata := metav1.ObjectMeta{
		Name:        compoenentName,
		Namespace:   orchest.Namespace,
		Labels:      orchest.Labels,
		Annotations: orchest.Annotations,
		OwnerReferences: []metav1.OwnerReference{{
			APIVersion:         orchest.APIVersion,
			Kind:               orchest.Kind,
			Name:               orchest.Name,
			UID:                orchest.UID,
			Controller:         &isController,
			BlockOwnerDeletion: &blockOwnerDeletion,
		}},
	}

	return metadata
}

func getServiceManifest(compoenentName string, port int, orchest *orchestv1alpha1.OrchestCluster) *corev1.Service {

	metadata := getMetadata(compoenentName, orchest)
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

func getRbacManifest(componentName string, metadata metav1.ObjectMeta) []client.Object {

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
				Name:      celeryWorkerName,
				Namespace: metadata.Namespace,
			},
		},
		RoleRef: rbacv1.RoleRef{
			APIGroup: "rbac.authorization.k8s.io",
			Name:     celeryWorkerName,
			Kind:     "ClusterRole",
		},
	}

	serviceAccount := &corev1.ServiceAccount{
		ObjectMeta: metadata,
	}

	return []client.Object{
		clusterRole, clusterRoleBinding, serviceAccount,
	}

}

// AddFinalizer adds specified finalizer string to object
func AddFinalizerIfNotPresent(ctx context.Context,
	ocClient versioned.Interface,
	orchest *orchestv1alpha1.OrchestCluster,
	finalizer string) error {

	if !utils.Contains(orchest.GetFinalizers(), finalizer) {
		klog.Infof("Failed to get finalizers of OrchestCluster: %s", orchest.GetName())
		orchest.SetFinalizers(append(orchest.GetFinalizers(), finalizer))

		_, err := ocClient.OrchestV1alpha1().OrchestClusters(orchest.Namespace).Update(ctx, orchest, metav1.UpdateOptions{})
		if err != nil {
			return errors.Wrapf(err, "failed to add finalizer %q to %q", finalizer, orchest.GetName())
		}
	}

	return nil
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

func ComputeHash(spec *orchestv1alpha1.OrchestClusterSpec) string {
	hasher := fnv.New32a()
	utils.DeepHashObject(hasher, *spec)

	return rand.SafeEncodeString(fmt.Sprint(hasher.Sum32()))
}
