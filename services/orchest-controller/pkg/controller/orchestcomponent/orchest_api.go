package orchestcomponent

import (
	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/controller"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	"golang.org/x/net/context"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
)

type OrchestApiReconciler struct {
	*OrchestComponentController
}

func NewOrchestApiReconciler(ctrl *OrchestComponentController) OrchestComponentReconciler {
	return &OrchestApiReconciler{
		ctrl,
	}
}

func (reconciler *OrchestApiReconciler) Reconcile(ctx context.Context, component *orchestv1alpha1.OrchestComponent) error {

	hash := controller.ComputeHash(component)
	matchLabels := controller.GetResourceMatchLables(controller.OrchestApi, component)
	metadata := controller.GetMetadata(controller.OrchestApi, hash, component, OrchestComponentKind)
	newDep := getOrchetApiDeployment(metadata, matchLabels, component)

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
			svc = getServiceManifest(metadata, matchLabels, 80, component)
			_, err = reconciler.Client().CoreV1().Services(component.Namespace).Create(ctx, svc, metav1.CreateOptions{})
			reconciler.EnqueueAfter(component)
			return err
		}
		return err
	}

	_, err = reconciler.ingLister.Ingresses(component.Namespace).Get(component.Name)
	if err != nil {
		if !kerrors.IsAlreadyExists(err) {
			ing := getIngressManifest(metadata, "/orchest-api", true, false, component)
			_, err = reconciler.Client().NetworkingV1().Ingresses(component.Namespace).Create(ctx, ing, metav1.CreateOptions{})
			reconciler.EnqueueAfter(component)
			return err
		}
		return err
	}

	if isServiceReady(ctx, reconciler.Client(), svc) &&
		isDeploymentReady(oldDep) {
		return reconciler.updatePhase(ctx, component, orchestv1alpha1.Running)
	}

	return nil
}

func (reconciler *OrchestApiReconciler) Uninstall(ctx context.Context, component *orchestv1alpha1.OrchestComponent) (bool, error) {

	err := reconciler.Client().AppsV1().Deployments(component.Namespace).Delete(ctx, component.Name, metav1.DeleteOptions{})
	if err != nil && !kerrors.IsNotFound(err) {
		return false, err
	}

	err = reconciler.Client().CoreV1().Services(component.Namespace).Delete(ctx, component.Name, metav1.DeleteOptions{})
	if err != nil && !kerrors.IsNotFound(err) {
		return false, err
	}

	err = reconciler.Client().NetworkingV1().Ingresses(component.Namespace).Delete(ctx, component.Name, metav1.DeleteOptions{})
	if err != nil && !kerrors.IsNotFound(err) {
		return false, err
	}

	// Get the cleanup pod
	pod, err := reconciler.Client().CoreV1().Pods(component.Namespace).Get(ctx, controller.OrchestApiCleanup, metav1.GetOptions{})
	if err != nil && !kerrors.IsNotFound(err) {
		return false, err
	} else if kerrors.IsNotFound(err) {
		// Cleanup pod is not found, we should create it
		hash := controller.ComputeHash(component)
		matchLabels := controller.GetResourceMatchLables(controller.OrchestApiCleanup, component)
		metadata := controller.GetMetadata(controller.OrchestApiCleanup, hash, component, OrchestComponentKind)
		cleanupPod := getCleanupPod(metadata, matchLabels, component)

		_, err = reconciler.Client().CoreV1().Pods(component.Namespace).Create(ctx, cleanupPod, metav1.CreateOptions{})
		reconciler.EnqueueAfter(component)
		return false, err
	}

	if !utils.IsPodActive(ctx, reconciler.Client(), pod) {
		// we won't delete the pod, the cleanup pod will be garbage collected once the OrchestComponent resource deleted
		return true, nil
	} else {
		return false, nil
	}

}

func getOrchetApiDeployment(metadata metav1.ObjectMeta,
	matchLabels map[string]string, component *orchestv1alpha1.OrchestComponent) *appsv1.Deployment {

	image := component.Spec.Template.Image

	envMap := utils.GetMapFromEnvVar(component.Spec.Template.Env)

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
		{
			Name: "tls-secret",
			VolumeSource: corev1.VolumeSource{
				Secret: &corev1.SecretVolumeSource{
					SecretName: "registry-tls-secret",
					Items: []corev1.KeyToPath{
						{
							Key:  "ca.crt",
							Path: "additional-ca-cert-bundle.crt",
						},
					},
				},
			},
		},
	}

	volumeMounts := []corev1.VolumeMount{
		{
			Name:      controller.UserDirName,
			MountPath: controller.UserdirMountPath,
		},
		{
			Name:      "tls-secret",
			MountPath: "/usr/lib/ssl/certs/additional-ca-cert-bundle.crt",
			SubPath:   "additional-ca-cert-bundle.crt",
			ReadOnly:  true,
		},
	}

	devMod := isDevelopmentEnabled(envMap)
	if devMod {
		devVolumes, devVolumeMounts := getDevVolumes(controller.OrchestApi, true, false, true)
		volumes = append(volumes, devVolumes...)
		volumeMounts = append(volumeMounts, devVolumeMounts...)
	}

	template := corev1.PodTemplateSpec{
		ObjectMeta: metav1.ObjectMeta{
			Labels: matchLabels,
		},
		Spec: corev1.PodSpec{
			ServiceAccountName: controller.OrchestApi,
			Volumes:            volumes,
			Containers: []corev1.Container{
				{
					Name:            controller.OrchestApi,
					Image:           image,
					ImagePullPolicy: corev1.PullIfNotPresent,
					Ports: []corev1.ContainerPort{
						{
							ContainerPort: 80,
						},
					},
					Env:          component.Spec.Template.Env,
					VolumeMounts: volumeMounts,
					ReadinessProbe: &corev1.Probe{
						ProbeHandler: corev1.ProbeHandler{
							HTTPGet: &corev1.HTTPGetAction{
								Path:   "/api",
								Port:   intstr.FromInt(80),
								Scheme: corev1.URISchemeHTTP,
							},
						},
						PeriodSeconds:    10,
						TimeoutSeconds:   2,
						SuccessThreshold: 1,
						FailureThreshold: 5,
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

func getCleanupPod(metadata metav1.ObjectMeta,
	matchLabels map[string]string, component *orchestv1alpha1.OrchestComponent) *corev1.Pod {

	pod := &corev1.Pod{
		ObjectMeta: metadata,
		Spec: corev1.PodSpec{
			RestartPolicy:      corev1.RestartPolicyNever,
			ServiceAccountName: controller.OrchestApi,
			Containers: []corev1.Container{
				{
					Name: metadata.Name,
					Command: []string{
						"/bin/sh", "-c",
					},
					Args: []string{
						"python migration_manager.py db migrate && python cleanup.py",
					},
					Image: component.Spec.Template.Image,
					Env:   component.Spec.Template.Env,
				},
			},
		},
	}

	return pod
}
