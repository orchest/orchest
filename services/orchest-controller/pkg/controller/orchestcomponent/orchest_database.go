package orchestcomponent

import (
	"context"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/controller"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type OrchestDatabaseReconciler struct {
	*OrchestComponentController
}

func NewOrchestDatabaseReconciler(ctrl *OrchestComponentController) OrchestComponentReconciler {
	return &OrchestDatabaseReconciler{
		ctrl,
	}
}

func (reconciler *OrchestDatabaseReconciler) Reconcile(ctx context.Context, component *orchestv1alpha1.OrchestComponent) error {

	hash := controller.ComputeHash(component)
	matchLabels := controller.GetResourceMatchLables(controller.OrchestDatabase, component)
	metadata := controller.GetMetadata(controller.OrchestDatabase, hash, component, OrchestComponentKind)
	newDep := getOrchetDatabaseDeployment(metadata, matchLabels, component)

	oldDep, err := reconciler.depLister.Deployments(component.Namespace).Get(component.Name)
	if err != nil {
		if !kerrors.IsAlreadyExists(err) {
			_, err = reconciler.Client().AppsV1().Deployments(component.Namespace).Create(ctx, newDep, metav1.CreateOptions{})
			reconciler.EnqueueAfter(component)
			return err
		}
		return err
	}

	if !isDeploymentUpdated(newDep, oldDep) {
		_, err := reconciler.Client().AppsV1().Deployments(component.Namespace).Update(ctx, newDep, metav1.UpdateOptions{})
		reconciler.EnqueueAfter(component)
		return err
	}

	svc, err := reconciler.svcLister.Services(component.Namespace).Get(component.Name)
	if err != nil {
		if !kerrors.IsAlreadyExists(err) {
			svc = getServiceManifest(metadata, matchLabels, 5432, component)
			_, err = reconciler.Client().CoreV1().Services(component.Namespace).Create(ctx, svc, metav1.CreateOptions{})
			reconciler.EnqueueAfter(component)
			return err
		}
		return err
	}

	if isServiceReady(ctx, reconciler.Client(), svc) && isDeploymentReady(oldDep) {
		return reconciler.updatePhase(ctx, component, orchestv1alpha1.Running)
	}

	return nil
}

func (reconciler *OrchestDatabaseReconciler) Uninstall(ctx context.Context, component *orchestv1alpha1.OrchestComponent) (bool, error) {
	err := reconciler.Client().AppsV1().Deployments(component.Namespace).Delete(ctx, component.Name, metav1.DeleteOptions{})
	if err != nil && !kerrors.IsNotFound(err) {
		return false, err
	}

	err = reconciler.Client().CoreV1().Services(component.Namespace).Delete(ctx, component.Name, metav1.DeleteOptions{})
	if err != nil && !kerrors.IsNotFound(err) {
		return false, err
	}

	return true, nil
}

func getOrchetDatabaseDeployment(metadata metav1.ObjectMeta,
	matchLabels map[string]string, component *orchestv1alpha1.OrchestComponent) *appsv1.Deployment {

	template := corev1.PodTemplateSpec{
		ObjectMeta: metav1.ObjectMeta{
			Labels: matchLabels,
		},
		Spec: corev1.PodSpec{
			Volumes: []corev1.Volume{
				{
					Name: controller.UserDirName,
					VolumeSource: corev1.VolumeSource{
						PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
							ClaimName: controller.UserDirName,
							ReadOnly:  false,
						},
					},
				},
			},
			Containers: []corev1.Container{
				{
					Name:            controller.OrchestDatabase,
					Image:           component.Spec.Template.Image,
					ImagePullPolicy: corev1.PullIfNotPresent,
					Ports: []corev1.ContainerPort{
						{
							ContainerPort: 5432,
						},
					},
					Env: component.Spec.Template.Env,
					VolumeMounts: []corev1.VolumeMount{
						{
							Name:      controller.UserDirName,
							MountPath: controller.DBMountPath,
							SubPath:   controller.DBSubPath,
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
		controller.DeploymentHashLabelKey: controller.ComputeHash(&deployment.Spec),
	})

	return deployment
}
