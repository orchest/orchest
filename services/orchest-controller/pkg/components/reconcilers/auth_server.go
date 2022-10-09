package reconcilers

import (
	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/controller"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	"golang.org/x/net/context"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

type AuthServerReconciler[Object client.Object] struct {
	*controller.Controller[Object]
	ingressClass string
}

func NewAuthServerReconciler[Object client.Object](controller *controller.Controller[Object]) ComponentReconciler {
	return &AuthServerReconciler[Object]{
		controller,
		"",
	}
}

func (reconciler *AuthServerReconciler[Object]) Reconcile(ctx context.Context, component *orchestv1alpha1.OrchestComponent) (bool, error) {

	hash := utils.ComputeHash(component)
	matchLabels := controller.GetResourceMatchLables(controller.AuthServer, component)
	metadata := controller.GetMetadata(controller.AuthServer, hash, component, OrchestComponentKind)
	newDep := getAuthServerDeployment(metadata, matchLabels, component)

	oldDep, err := reconciler.Client().AppsV1().Deployments(component.Namespace).Get(ctx, component.Name, metav1.GetOptions{})
	if err != nil {
		if kerrors.IsNotFound(err) {
			_, err = reconciler.Client().AppsV1().Deployments(component.Namespace).Create(ctx, newDep, metav1.CreateOptions{})
		}
		reconciler.EnqueueAfter(component)
		return false, nil
	}

	if !isDeploymentUpdated(newDep, oldDep) {
		_, err := reconciler.Client().AppsV1().Deployments(component.Namespace).Update(ctx, newDep, metav1.UpdateOptions{})
		reconciler.EnqueueAfter(component)
		return false, err
	}

	svc, err := reconciler.Client().CoreV1().Services(component.Namespace).Get(ctx, component.Name, metav1.GetOptions{})
	if err != nil {
		if kerrors.IsNotFound(err) {
			svc = getServiceManifest(metadata, matchLabels, 80, component)
			_, err = reconciler.Client().CoreV1().Services(component.Namespace).Create(ctx, svc, metav1.CreateOptions{})
		}
		reconciler.EnqueueAfter(component)
		return false, err
	}

	if reconciler.ingressClass == "" {
		reconciler.ingressClass, err = detectIngressClass(ctx, reconciler.Client())
		if err != nil {
			return false, err
		}
	}

	_, err = reconciler.Client().NetworkingV1().Ingresses(component.Namespace).Get(ctx, component.Name, metav1.GetOptions{})
	if err != nil {
		if !kerrors.IsAlreadyExists(err) {
			ing := getIngressManifest(metadata, "/login", reconciler.ingressClass, false, false, component)
			_, err = reconciler.Client().NetworkingV1().Ingresses(component.Namespace).Create(ctx, ing, metav1.CreateOptions{})
		}
		reconciler.EnqueueAfter(component)
		return false, err
	}

	if !isServiceReady(ctx, reconciler.Client(), svc) || !isDeploymentReady(oldDep) {
		reconciler.EnqueueAfter(component)
		return false, err
	}

	return true, err
}

func (reconciler *AuthServerReconciler[Object]) Uninstall(ctx context.Context, component *orchestv1alpha1.OrchestComponent) (bool, error) {

	err := reconciler.Client().AppsV1().Deployments(component.Namespace).Delete(ctx, component.Name, metav1.DeleteOptions{})
	if err != nil && !kerrors.IsNotFound(err) {
		return false, err
	}

	err = reconciler.Client().NetworkingV1().Ingresses(component.Namespace).Delete(ctx, component.Name, metav1.DeleteOptions{})
	if err != nil && !kerrors.IsNotFound(err) {
		return false, err
	}

	return true, nil
}

func getAuthServerDeployment(metadata metav1.ObjectMeta,
	matchLabels map[string]string, component *orchestv1alpha1.OrchestComponent) *appsv1.Deployment {

	envMap := utils.GetMapFromEnvVar(component.Spec.Template.Env)

	image := component.Spec.Template.Image

	dnsResolverTimeout := "10"
	dnsResolverAttempts := "5"

	template := corev1.PodTemplateSpec{
		ObjectMeta: metav1.ObjectMeta{
			Labels: matchLabels,
		},
		Spec: corev1.PodSpec{
			DNSConfig: &corev1.PodDNSConfig{
				Options: []corev1.PodDNSConfigOption{
					{Name: "timeout", Value: &dnsResolverTimeout},
					{Name: "attempts", Value: &dnsResolverAttempts},
				},
			},
			Containers: []corev1.Container{
				{
					Name:            controller.AuthServer,
					Image:           image,
					ImagePullPolicy: corev1.PullIfNotPresent,
					Ports: []corev1.ContainerPort{
						{
							ContainerPort: 80,
						},
					},
					Env: component.Spec.Template.Env,
					Resources: corev1.ResourceRequirements{
						Requests: corev1.ResourceList{corev1.ResourceCPU: resource.MustParse("50m")},
					},
				},
			},
		},
	}

	devMod := isDevelopmentEnabled(envMap)

	if devMod {
		volumes, volumeMounts := getDevVolumes(controller.AuthServer, true, true, true)
		template.Spec.Volumes = volumes
		template.Spec.Containers[0].VolumeMounts = volumeMounts
	}

	deployment := &appsv1.Deployment{
		ObjectMeta: metadata,
		Spec: appsv1.DeploymentSpec{
			Selector: &metav1.LabelSelector{
				MatchLabels: matchLabels,
			},
			Template: template,
			Strategy: appsv1.DeploymentStrategy{
				Type: appsv1.RecreateDeploymentStrategyType,
			},
		},
	}

	deployment.Labels = utils.CloneAndAddLabel(metadata.Labels, map[string]string{
		controller.DeploymentHashLabelKey: utils.ComputeHash(&deployment.Spec),
	})

	return deployment

}
