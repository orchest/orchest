package reconcilers

import (
	"context"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/components"
	"github.com/orchest/orchest/services/orchest-controller/pkg/controller"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

type OrchestDatabaseReconciler[Object client.Object] struct {
	*components.NativeComponent[Object]
}

func NewOrchestDatabaseReconciler[Object client.Object](component *components.NativeComponent[Object]) components.NativeComponentReconciler {
	return &OrchestDatabaseReconciler[Object]{
		component,
	}
}

func (reconciler *OrchestDatabaseReconciler[Object]) Reconcile(ctx context.Context, component *orchestv1alpha1.OrchestComponent) error {

	hash := utils.ComputeHash(component)
	matchLabels := controller.GetResourceMatchLables(controller.OrchestDatabase, component)
	metadata := controller.GetMetadata(controller.OrchestDatabase, hash, component, components.OrchestComponentKind)
	newDep := getOrchestDatabaseDeployment(metadata, matchLabels, component)

	oldDep, err := reconciler.DepLister.Deployments(component.Namespace).Get(component.Name)
	if err != nil {
		if !kerrors.IsAlreadyExists(err) {
			_, err = reconciler.Client().AppsV1().Deployments(component.Namespace).Create(ctx, newDep, metav1.CreateOptions{})
			reconciler.EnqueueAfter(component)
			return err
		}
		return err
	}

	if !components.IsDeploymentUpdated(newDep, oldDep) {
		_, err := reconciler.Client().AppsV1().Deployments(component.Namespace).Update(ctx, newDep, metav1.UpdateOptions{})
		reconciler.EnqueueAfter(component)
		return err
	}

	svc, err := reconciler.SvcLister.Services(component.Namespace).Get(component.Name)
	if err != nil {
		if !kerrors.IsAlreadyExists(err) {
			svc = components.GetServiceManifest(metadata, matchLabels, 5432, component)
			_, err = reconciler.Client().CoreV1().Services(component.Namespace).Create(ctx, svc, metav1.CreateOptions{})
			reconciler.EnqueueAfter(component)
			return err
		}
		return err
	}

	if components.IsServiceReady(ctx, reconciler.Client(), svc) && components.IsDeploymentReady(oldDep) {
		return nil
		//return reconciler.updatePhase(ctx, component, orchestv1alpha1.Running)
	}

	return nil
}

func (reconciler *OrchestDatabaseReconciler[Object]) Uninstall(ctx context.Context, component *orchestv1alpha1.OrchestComponent) (bool, error) {
	err := reconciler.Client().AppsV1().Deployments(component.Namespace).Delete(ctx, component.Name, metav1.DeleteOptions{
		PropagationPolicy: &components.DeletePropagationForeground,
	})
	if err != nil && !kerrors.IsNotFound(err) {
		return false, err
	}

	return true, nil
}

func getOrchestDatabaseDeployment(metadata metav1.ObjectMeta,
	matchLabels map[string]string, component *orchestv1alpha1.OrchestComponent) *appsv1.Deployment {

	dnsResolverTimeout := "10"
	dnsResolverAttempts := "5"

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
			DNSConfig: &corev1.PodDNSConfig{
				Options: []corev1.PodDNSConfigOption{
					{Name: "timeout", Value: &dnsResolverTimeout},
					{Name: "attempts", Value: &dnsResolverAttempts},
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
					Resources: corev1.ResourceRequirements{
						Requests: corev1.ResourceList{corev1.ResourceCPU: resource.MustParse("100m")},
					},
					VolumeMounts: []corev1.VolumeMount{
						{
							Name:      controller.UserDirName,
							MountPath: controller.DBMountPath,
							SubPath:   controller.DBSubPath,
						},
					},
					ReadinessProbe: &corev1.Probe{
						ProbeHandler: corev1.ProbeHandler{
							Exec: &corev1.ExecAction{
								Command: []string{
									"pg_isready",
									"--username",
									"postgres",
								},
							},
						},
						InitialDelaySeconds: 1,
						PeriodSeconds:       4,
						TimeoutSeconds:      15,
						SuccessThreshold:    1,
						FailureThreshold:    10,
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
