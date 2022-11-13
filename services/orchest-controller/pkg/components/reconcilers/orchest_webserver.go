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

type OrchestWebServerReconciler[Object client.Object] struct {
	*controller.Controller[Object]
	ingressClass string
}

func NewOrchestWebServerReconciler[Object client.Object](controller *controller.Controller[Object]) ComponentReconciler {
	return &OrchestWebServerReconciler[Object]{
		controller,
		"",
	}
}

func (reconciler *OrchestWebServerReconciler[Object]) Reconcile(ctx context.Context, component *orchestv1alpha1.OrchestComponent) (bool, error) {

	hash := utils.ComputeHash(component)
	matchLabels := controller.GetResourceMatchLables(controller.OrchestWebserver, component)
	metadata := controller.GetMetadata(controller.OrchestWebserver, hash, component, OrchestComponentKind)
	newDep := getOrchestWebserverDeployment(metadata, matchLabels, component)

	oldDep, err := reconciler.Client().AppsV1().Deployments(component.Namespace).Get(ctx, component.Name, metav1.GetOptions{})
	if err != nil {
		if kerrors.IsNotFound(err) {
			_, err = reconciler.Client().AppsV1().Deployments(component.Namespace).Create(ctx, newDep, metav1.CreateOptions{})
		}
		reconciler.EnqueueAfter(component)
		return false, err
	}

	if !isDeploymentUpdated(newDep, oldDep) {
		_, err := reconciler.Client().AppsV1().Deployments(component.Namespace).Update(ctx, newDep, metav1.UpdateOptions{})
		reconciler.EnqueueAfter(component)
		return false, err
	}

	svc, err := reconciler.Client().CoreV1().Services(component.Namespace).Get(ctx, component.Name, metav1.GetOptions{})
	if err != nil {
		if !kerrors.IsAlreadyExists(err) {
			svc = getServiceManifest(metadata, matchLabels, 80, component)
			_, err = reconciler.Client().CoreV1().Services(component.Namespace).Create(ctx, svc, metav1.CreateOptions{})
		}
		reconciler.EnqueueAfter(component)
		return false, err
	}

	if reconciler.ingressClass == "" {
		reconciler.ingressClass, err = detectIngressClass(ctx, reconciler.Client())
		if err != nil {
			reconciler.EnqueueAfter(component)
			return false, err
		}
	}

	oldIng, err := reconciler.Client().NetworkingV1().Ingresses(component.Namespace).Get(ctx, component.Name, metav1.GetOptions{})
	if err != nil {
		if !kerrors.IsAlreadyExists(err) {
			ing := getIngressManifest(metadata, "/", reconciler.ingressClass, true, true, component)
			_, err = reconciler.Client().NetworkingV1().Ingresses(component.Namespace).Create(ctx, ing, metav1.CreateOptions{})
		}
		reconciler.EnqueueAfter(component)
		return false, err
	}

	if !isServiceReady(ctx, reconciler.Client(), svc) ||
		!isDeploymentReady(oldDep) && isIngressReady(oldIng) {
		reconciler.EnqueueAfter(component)
		return false, err
	}

	return true, err
}

func (reconciler *OrchestWebServerReconciler[Object]) Uninstall(ctx context.Context, component *orchestv1alpha1.OrchestComponent) (bool, error) {

	err := reconciler.Client().AppsV1().Deployments(component.Namespace).Delete(ctx, component.Name, metav1.DeleteOptions{})
	if err != nil && !kerrors.IsNotFound(err) {
		reconciler.EnqueueAfter(component)
		return false, err
	}

	err = reconciler.Client().NetworkingV1().Ingresses(component.Namespace).Delete(ctx, component.Name, metav1.DeleteOptions{})
	if err != nil && !kerrors.IsNotFound(err) {
		reconciler.EnqueueAfter(component)
		return false, err
	}
	return true, nil
}

func getOrchestWebserverDeployment(metadata metav1.ObjectMeta,
	matchLabels map[string]string, component *orchestv1alpha1.OrchestComponent) *appsv1.Deployment {

	image := component.Spec.Template.Image

	envMap := utils.GetMapFromEnvVar(component.Spec.Template.Env)

	devMod := isDevelopmentEnabled(envMap)

	volumes := []corev1.Volume{
		{
			Name: controller.UserDirName,
			VolumeSource: corev1.VolumeSource{
				PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
					ClaimName: controller.UserDirName,
					ReadOnly:  false,
				},
			},
		},
	}

	volumeMounts := []corev1.VolumeMount{
		{
			Name:      controller.UserDirName,
			MountPath: controller.UserdirMountPath,
		},
	}

	if devMod {
		devVolumes, devVolumeMounts := getDevVolumes(controller.OrchestWebserver, true, true, true)
		volumes = append(volumes, devVolumes...)
		volumeMounts = append(volumeMounts, devVolumeMounts...)
	}

	dnsResolverTimeout := "10"
	dnsResolverAttempts := "5"

	template := corev1.PodTemplateSpec{
		ObjectMeta: metav1.ObjectMeta{
			Labels: matchLabels,
		},
		Spec: corev1.PodSpec{
			Volumes: volumes,
			DNSConfig: &corev1.PodDNSConfig{
				Options: []corev1.PodDNSConfigOption{
					{Name: "timeout", Value: &dnsResolverTimeout},
					{Name: "attempts", Value: &dnsResolverAttempts},
				},
			},
			Containers: []corev1.Container{
				{
					Name:            controller.OrchestWebserver,
					Image:           image,
					ImagePullPolicy: corev1.PullIfNotPresent,
					Ports: []corev1.ContainerPort{
						{
							ContainerPort: 80,
						},
					},
					Env: component.Spec.Template.Env,
					Resources: corev1.ResourceRequirements{
						Requests: corev1.ResourceList{corev1.ResourceCPU: resource.MustParse("100m")},
					},
					VolumeMounts: volumeMounts,
				},
				{
					Name:            "log-streamer",
					Command:         []string{"python"},
					Args:            []string{"/orchest/services/orchest-webserver/app/scripts/log_streamer.py"},
					Image:           image,
					ImagePullPolicy: corev1.PullIfNotPresent,
					Resources: corev1.ResourceRequirements{
						Requests: corev1.ResourceList{corev1.ResourceCPU: resource.MustParse("20m")},
					},
					VolumeMounts: volumeMounts,
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
