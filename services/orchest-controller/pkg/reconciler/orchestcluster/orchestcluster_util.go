package orchestcluster

import (
	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

func getMatchLables(compoenentName string, orchest *orchestv1alpha1.OrchestCluster) map[string]string {
	matchLabels := utils.DeepCopy(orchest.GetLabels())
	matchLabels[ControllerLabelKey] = orchest.Name
	matchLabels[ComponentLabelKey] = compoenentName
	return matchLabels
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
