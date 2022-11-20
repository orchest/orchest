package reconcilers

import (
	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/controller"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	"golang.org/x/net/context"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

type RabbitmqServerReconciler[Object client.Object] struct {
	*controller.Controller[Object]
}

func NewRabbitmqServerReconciler[Object client.Object](controller *controller.Controller[Object]) ComponentReconciler {
	return &RabbitmqServerReconciler[Object]{
		Controller: controller,
	}
}

func (reconciler *RabbitmqServerReconciler[Object]) Reconcile(ctx context.Context, component *orchestv1alpha1.OrchestComponent) (bool, error) {

	hash := utils.ComputeHash(component)
	matchLabels := controller.GetResourceMatchLables(controller.Rabbitmq, component)
	metadata := controller.GetMetadata(controller.Rabbitmq, hash, component, OrchestComponentKind)
	newDep := getRabbitMqDeployment(metadata, matchLabels, component)

	oldDep, err := reconciler.Client().AppsV1().Deployments(component.Namespace).Get(ctx, component.Name, metav1.GetOptions{})
	if err != nil {
		if kerrors.IsNotFound(err) {
			_, err = reconciler.Client().AppsV1().Deployments(component.Namespace).Create(ctx, newDep, metav1.CreateOptions{})
			reconciler.EnqueueAfter(component)
			return false, nil
		}
		return false, err
	}

	if !isDeploymentUpdated(newDep, oldDep) {
		_, err := reconciler.Client().AppsV1().Deployments(component.Namespace).Update(ctx, newDep, metav1.UpdateOptions{})
		reconciler.EnqueueAfter(component)
		return false, err
	}

	svc, err := reconciler.Client().CoreV1().Services(component.Namespace).Get(ctx, component.Name, metav1.GetOptions{})
	if err != nil {
		if kerrors.IsNotFound(err) {
			svc = getServiceManifest(metadata, matchLabels, 5672, component)
			_, err = reconciler.Client().CoreV1().Services(component.Namespace).Create(ctx, svc, metav1.CreateOptions{})
			reconciler.EnqueueAfter(component)
			return false, nil
		}
		return false, err
	}

	if !isServiceReady(ctx, reconciler.Client(), svc) || !isDeploymentReady(oldDep) {
		reconciler.EnqueueAfter(component)
		return false, nil
	}

	return true, nil
}

func (reconciler *RabbitmqServerReconciler[Object]) Uninstall(ctx context.Context, component *orchestv1alpha1.OrchestComponent) (bool, error) {
	err := reconciler.Client().AppsV1().Deployments(component.Namespace).Delete(ctx, component.Name, metav1.DeleteOptions{})
	if err != nil && !kerrors.IsNotFound(err) {
		return false, err
	}

	return true, nil
}

func getRabbitMqDeployment(metadata metav1.ObjectMeta,
	matchLabels map[string]string, component *orchestv1alpha1.OrchestComponent) *appsv1.Deployment {

	template := corev1.PodTemplateSpec{
		ObjectMeta: metav1.ObjectMeta{
			Labels: matchLabels,
		},
		Spec: corev1.PodSpec{
			Volumes: []corev1.Volume{
				{
					Name: controller.StateVolumeName,
					VolumeSource: corev1.VolumeSource{
						PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
							ClaimName: controller.StateVolumeName,
							ReadOnly:  false,
						},
					},
				},
			},
			Containers: []corev1.Container{
				{
					Name:            controller.Rabbitmq,
					Image:           component.Spec.Template.Image,
					ImagePullPolicy: corev1.PullIfNotPresent,
					Ports: []corev1.ContainerPort{
						{
							ContainerPort: 5672,
						},
					},
					Env: component.Spec.Template.Env,
					VolumeMounts: []corev1.VolumeMount{
						{
							Name:      controller.StateVolumeName,
							MountPath: controller.RabbitmountPath,
							SubPath:   controller.RabbitSubPath,
						},
					},
				},
			},
		},
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
