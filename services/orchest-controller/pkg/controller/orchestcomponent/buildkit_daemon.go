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
)

type BuildKitDaemonReconciler struct {
	*OrchestComponentController
}

func NewBuildKitDaemonReconciler(ctrl *OrchestComponentController) OrchestComponentReconciler {
	return &BuildKitDaemonReconciler{
		ctrl,
	}
}

func (reconciler *BuildKitDaemonReconciler) Reconcile(ctx context.Context, component *orchestv1alpha1.OrchestComponent) error {
	hash := utils.ComputeHash(component)
	matchLabels := controller.GetResourceMatchLables(controller.BuildKitDaemon, component)
	metadata := controller.GetMetadata(controller.BuildKitDaemon, hash, component, OrchestComponentKind)
	newDs, err := getBuildKitDaemonDaemonset(metadata, matchLabels, component)
	if err != nil {
		return err
	}

	_, err = reconciler.dsLister.DaemonSets(component.Namespace).Get(component.Name)
	if err != nil {
		if !kerrors.IsAlreadyExists(err) {
			_, err = reconciler.Client().AppsV1().DaemonSets(component.Namespace).Create(ctx, newDs, metav1.CreateOptions{})
			reconciler.EnqueueAfter(component)
			return err
		}
		return err
	}

	return reconciler.updatePhase(ctx, component, orchestv1alpha1.Running)

}

func (reconciler *BuildKitDaemonReconciler) Uninstall(ctx context.Context, component *orchestv1alpha1.OrchestComponent) (bool, error) {

	err := reconciler.Client().AppsV1().DaemonSets(component.Namespace).Delete(ctx, component.Name, metav1.DeleteOptions{})
	if err != nil && !kerrors.IsNotFound(err) {
		return false, err
	}

	return true, nil
}

func getBuildKitDaemonDaemonset(metadata metav1.ObjectMeta,
	matchLabels map[string]string, component *orchestv1alpha1.OrchestComponent) (
	*appsv1.DaemonSet, error) {

	socketPath := utils.GetKeyFromEnvVar(component.Spec.Template.Env, "CONTAINER_RUNTIME_SOCKET")
	hostPathSocket := corev1.HostPathSocket
	hostPathDirectoryOrCreate := corev1.HostPathDirectoryOrCreate
	bidirectional_propagation := corev1.MountPropagationBidirectional

	var var_one int64 = 1
	var var_true bool = true
	template := corev1.PodTemplateSpec{
		ObjectMeta: metav1.ObjectMeta{
			Labels: matchLabels,
		},
		Spec: corev1.PodSpec{
			TerminationGracePeriodSeconds: &var_one,
			Volumes: []corev1.Volume{
				{
					Name: "containerd-socket",
					VolumeSource: corev1.VolumeSource{
						HostPath: &corev1.HostPathVolumeSource{
							Path: socketPath,
							Type: &hostPathSocket,
						},
					},
				},
				// TODO: allow customizing this for k8s flavours that
				// may have containerd in non standard locations (k3s).
				{
					Name: "run-containerd",
					VolumeSource: corev1.VolumeSource{
						HostPath: &corev1.HostPathVolumeSource{
							Path: "/run/containerd",
							Type: &hostPathDirectoryOrCreate,
						},
					},
				},
				{
					Name: "var-lib-containerd",
					VolumeSource: corev1.VolumeSource{
						HostPath: &corev1.HostPathVolumeSource{
							Path: "/var/lib/containerd",
							Type: &hostPathDirectoryOrCreate,
						},
					},
				},
				// Use a separate buildkit socket location for safety.
				{
					Name: "run-orchest-buildkit",
					VolumeSource: corev1.VolumeSource{
						HostPath: &corev1.HostPathVolumeSource{
							Path: "/run/orchest_buildkit",
							Type: &hostPathDirectoryOrCreate,
						},
					},
				},
				// Use a separate buildkit storage for safety
				// and in case we want to cleanup in the future.
				{
					Name: "orchest-buildkit-storage",
					VolumeSource: corev1.VolumeSource{
						HostPath: &corev1.HostPathVolumeSource{
							Path: "/var/lib/orchest_buildkit",
							Type: &hostPathDirectoryOrCreate,
						},
					},
				},
			},
			Containers: []corev1.Container{
				{
					Name:            controller.BuildKitDaemon,
					Image:           component.Spec.Template.Image,
					Env:             component.Spec.Template.Env,
					ImagePullPolicy: corev1.PullIfNotPresent,
					SecurityContext: &corev1.SecurityContext{
						Privileged: &var_true,
					},
					// Probes from buildkitd k8s examples.
					ReadinessProbe: &corev1.Probe{
						ProbeHandler: corev1.ProbeHandler{
							Exec: &corev1.ExecAction{
								Command: []string{
									"buildctl",
									"--addr",
									"unix:///run/orchest_buildkit/buildkitd.sock",
									"debug",
									"workers",
								},
							},
						},
						InitialDelaySeconds: 5,
						PeriodSeconds:       30,
					},
					LivenessProbe: &corev1.Probe{
						ProbeHandler: corev1.ProbeHandler{
							Exec: &corev1.ExecAction{
								Command: []string{
									"buildctl",
									"--addr",
									"unix:///run/orchest_buildkit/buildkitd.sock",
									"debug",
									"workers",
								},
							},
						},
						InitialDelaySeconds: 5,
						PeriodSeconds:       30,
					},
					VolumeMounts: []corev1.VolumeMount{
						{
							Name:      "containerd-socket",
							MountPath: socketPath,
						},
						{
							Name:      "run-containerd",
							MountPath: "/run/containerd",
						},
						{
							Name:      "var-lib-containerd",
							MountPath: "/var/lib/containerd",
						},
						{
							Name:      "run-orchest-buildkit",
							MountPath: "/run/orchest_buildkit",
						},
						{
							Name:             "orchest-buildkit-storage",
							MountPath:        "/var/lib/orchest_buildkit",
							MountPropagation: &bidirectional_propagation,
						},
					},
				},
			},
		},
	}

	daemonSet := &appsv1.DaemonSet{
		ObjectMeta: metadata,
		Spec: appsv1.DaemonSetSpec{
			Selector: &metav1.LabelSelector{
				MatchLabels: matchLabels,
			},
			Template: template,
		},
	}

	return daemonSet, nil

}
