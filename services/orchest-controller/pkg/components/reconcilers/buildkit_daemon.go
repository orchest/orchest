package reconcilers

import (
	"strings"

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

type BuildKitDaemonReconciler[Object client.Object] struct {
	*controller.Controller[Object]
}

func NewBuildKitDaemonReconciler[Object client.Object](controller *controller.Controller[Object]) ComponentReconciler {
	return &BuildKitDaemonReconciler[Object]{
		controller,
	}
}

func (reconciler *BuildKitDaemonReconciler[Object]) Reconcile(ctx context.Context, component *orchestv1alpha1.OrchestComponent) (bool, error) {
	hash := utils.ComputeHash(component)
	matchLabels := controller.GetResourceMatchLables(controller.BuildKitDaemon, component)
	metadata := controller.GetMetadata(controller.BuildKitDaemon, hash, component, OrchestComponentKind)
	newDs, err := getBuildKitDaemonDaemonset(metadata, matchLabels, component)
	if err != nil {
		return false, err
	}

	_, err = reconciler.Client().AppsV1().DaemonSets(component.Namespace).Get(ctx, component.Name, metav1.GetOptions{})
	if err != nil {
		if kerrors.IsNotFound(err) {
			_, err = reconciler.Client().AppsV1().DaemonSets(component.Namespace).Create(ctx, newDs, metav1.CreateOptions{})
		}
		reconciler.EnqueueAfter(component)
		return false, err
	}

	return true, err

}

func (reconciler *BuildKitDaemonReconciler[Object]) Uninstall(ctx context.Context, component *orchestv1alpha1.OrchestComponent) (bool, error) {

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

	runContainerdPath := "/run/containerd"
	varLibContainerdPath := "/var/lib/containerd"

	// TODO: use distribution from https://github.com/orchest/orchest/pull/1267.
	if strings.Contains(socketPath, "microk8s") {
		runContainerdPath = "/var/snap/microk8s/common/run/containerd"
		varLibContainerdPath = "/var/snap/microk8s/common/var/lib/containerd"
	} else if strings.Contains(socketPath, "k3s") {
		runContainerdPath = "/var/run/k3s/containerd"
		varLibContainerdPath = "/var/lib/rancher/k3s/agent/containerd"
	}

	volumes := []corev1.Volume{
		{
			Name: "containerd-socket",
			VolumeSource: corev1.VolumeSource{
				HostPath: &corev1.HostPathVolumeSource{
					Path: socketPath,
					Type: &hostPathSocket,
				},
			},
		},
		{
			Name: "run-containerd",
			VolumeSource: corev1.VolumeSource{
				HostPath: &corev1.HostPathVolumeSource{
					Path: runContainerdPath,
					Type: &hostPathDirectoryOrCreate,
				},
			},
		},
		{
			Name: "var-lib-containerd",
			VolumeSource: corev1.VolumeSource{
				HostPath: &corev1.HostPathVolumeSource{
					Path: varLibContainerdPath,
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
	}

	volumeMounts := []corev1.VolumeMount{
		{
			Name:      "containerd-socket",
			MountPath: "/run/containerd/containerd.sock",
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
	}

	if strings.Contains(socketPath, "microk8s") || strings.Contains(socketPath, "k3s") {
		volumes = append(volumes, corev1.Volume{
			Name: "run-containerd-fifo",
			VolumeSource: corev1.VolumeSource{
				HostPath: &corev1.HostPathVolumeSource{
					Path: "/run/containerd/fifo",
					Type: &hostPathDirectoryOrCreate,
				},
			},
		})

		volumeMounts = append(volumeMounts,
			corev1.VolumeMount{
				Name:      "run-containerd-fifo",
				MountPath: "/run/containerd/fifo",
			},
			corev1.VolumeMount{
				Name:      "run-containerd",
				MountPath: runContainerdPath,
			},
			corev1.VolumeMount{
				Name:      "var-lib-containerd",
				MountPath: varLibContainerdPath,
			},
		)
	}

	var var_one int64 = 1
	var var_true bool = true
	template := corev1.PodTemplateSpec{
		ObjectMeta: metav1.ObjectMeta{
			Labels: matchLabels,
		},
		Spec: corev1.PodSpec{
			TerminationGracePeriodSeconds: &var_one,
			Volumes:                       volumes,
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
					VolumeMounts: volumeMounts},
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
