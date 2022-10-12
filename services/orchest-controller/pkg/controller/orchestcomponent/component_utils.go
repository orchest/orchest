package orchestcomponent

import (
	"context"
	"errors"
	"fmt"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/controller"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	netsv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

var (
	DeletePropagationForeground = metav1.DeletionPropagation("Foreground")
)

func getServiceManifest(metadata metav1.ObjectMeta,
	matchLabels map[string]string, port int,
	component *orchestv1alpha1.OrchestComponent) *corev1.Service {

	objectMeta := metadata.DeepCopy()
	objectMeta.OwnerReferences = component.OwnerReferences

	service := &corev1.Service{
		ObjectMeta: *objectMeta,
		Spec: corev1.ServiceSpec{
			Selector: matchLabels,
			Ports: []corev1.ServicePort{
				{
					Port: int32(port),
				},
			},
		},
	}

	return service
}

func getDevVolumes(service string, mountApp, mountClient, mountInternalLib bool) ([]corev1.Volume, []corev1.VolumeMount) {

	volumeType := corev1.HostPathDirectoryOrCreate

	volumes := []corev1.Volume{
		{
			Name: "orchest-dev-repo",
			VolumeSource: corev1.VolumeSource{
				HostPath: &corev1.HostPathVolumeSource{
					Path: "/orchest-dev-repo",
					Type: &volumeType,
				},
			},
		},
	}

	volumeMounts := make([]corev1.VolumeMount, 0)

	if mountApp {
		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			Name:      "orchest-dev-repo",
			MountPath: fmt.Sprintf("/orchest/services/%s/app", service),
			SubPath:   fmt.Sprintf("services/%s/app", service),
		})
	}

	if mountClient {
		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			Name:      "orchest-dev-repo",
			MountPath: fmt.Sprintf("/orchest/services/%s/client", service),
			SubPath:   fmt.Sprintf("services/%s/client", service),
		})
	} else {
		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			Name:      "orchest-dev-repo",
			MountPath: "/orchest/orchest-cli",
			SubPath:   "orchest-cli",
		})
		// Needed to test `orchest update` invoked through the UI
		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			Name:      "orchest-dev-repo",
			MountPath: "/orchest/services/orchest-controller/deploy",
			SubPath:   "services/orchest-controller/deploy",
		})
	}

	if mountInternalLib {
		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			Name:      "orchest-dev-repo",
			MountPath: "/orchest/lib",
			SubPath:   "lib",
		})
	}

	return volumes, volumeMounts
}

func detectIngressClass(ctx context.Context, client kubernetes.Interface) (string, error) {

	// Detect ingress class name
	ingressClasses, err := client.NetworkingV1().IngressClasses().List(ctx, metav1.ListOptions{})
	if err != nil {
		return "", err
	}

	for _, ingressClass := range ingressClasses.Items {
		if controller.IsNginxIngressClass(ingressClass.Spec.Controller) {
			return ingressClass.Name, nil
		}
	}

	return "", errors.New("failed to detect ingress class name")

}

func getIngressManifest(metadata metav1.ObjectMeta, path, ingressClass string,
	enableAuth, enableSignin bool, component *orchestv1alpha1.OrchestComponent) *netsv1.Ingress {

	ingressMeta := *metadata.DeepCopy()

	if ingressMeta.Annotations == nil {
		ingressMeta.Annotations = make(map[string]string)
	}

	ingressMeta.Annotations["nginx.ingress.kubernetes.io/proxy-body-size"] = "0"

	if enableAuth {
		authServiceName := fmt.Sprintf("http://auth-server.%s.svc.cluster.local/auth", component.Namespace)
		ingressMeta.Annotations["nginx.ingress.kubernetes.io/auth-url"] = authServiceName

	}

	if enableSignin {
		ingressMeta.Annotations["nginx.ingress.kubernetes.io/auth-signin"] = "/login"
	}

	rule := netsv1.IngressRule{}
	if component.Spec.OrchestHost != nil {
		rule.Host = *component.Spec.OrchestHost
	}

	rule.HTTP = &netsv1.HTTPIngressRuleValue{
		Paths: []netsv1.HTTPIngressPath{
			{
				Path:     path,
				PathType: &controller.PrefixPathType,
				Backend: netsv1.IngressBackend{
					Service: &netsv1.IngressServiceBackend{
						Name: metadata.Name,
						Port: netsv1.ServiceBackendPort{
							Number: 80,
						},
					},
				},
			},
		},
	}

	ingress := &netsv1.Ingress{
		ObjectMeta: ingressMeta,
		Spec: netsv1.IngressSpec{
			IngressClassName: &ingressClass,
			Rules: []netsv1.IngressRule{
				rule,
			},
		},
	}

	return ingress
}

func isDeploymentUpdated(newDep *appsv1.Deployment, oldDep *appsv1.Deployment) bool {
	if oldHash, _ := oldDep.Labels[controller.DeploymentHashLabelKey]; oldHash == utils.ComputeHash(&newDep.Spec) {
		return true
	}
	return false
}

// isServiceReady aims to check if the service is reachable or not
func isServiceReady(ctx context.Context, client kubernetes.Interface, service *corev1.Service) bool {
	ep, err := client.CoreV1().Endpoints(service.Namespace).Get(ctx, service.Name, metav1.GetOptions{})
	if err != nil || len(ep.Subsets) == 0 {
		return false
	}

	return true
}

// isDeploymentReady checks if the number of required replicas is equal to number of created replicas
func isDeploymentReady(dep *appsv1.Deployment) bool {
	return dep.Spec.Replicas != nil && *dep.Spec.Replicas == dep.Status.ReadyReplicas
}

// isIngressReady checks fore readiness of the ingress
func isIngressReady(ing *netsv1.Ingress) bool {
	return len(ing.Status.LoadBalancer.Ingress) > 0
}

func isDevelopmentEnabled(envMap map[string]string) bool {
	value, ok := envMap["FLASK_ENV"]
	if ok && value == "development" {
		return true
	}
	return false
}
