package orchestcomponent

import (
	"fmt"

	"github.com/orchest/orchest/services/orchest-controller/pkg/addons"
	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/controller"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	"golang.org/x/net/context"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type NodeAgentReconciler struct {
	*OrchestComponentController
}

func NewNodeAgentReconciler(ctrl *OrchestComponentController) OrchestComponentReconciler {
	return &NodeAgentReconciler{
		ctrl,
	}
}

func (reconciler *NodeAgentReconciler) Reconcile(ctx context.Context, component *orchestv1alpha1.OrchestComponent) error {

	// first retrive the registry IP
	registryService, err := reconciler.Client().CoreV1().Services(component.Namespace).Get(ctx, addons.DockerRegistry, metav1.GetOptions{})
	if err != nil {
		return err
	}

	registryIP := registryService.Spec.ClusterIP

	hash := utils.ComputeHash(component)
	matchLabels := controller.GetResourceMatchLables(controller.NodeAgent, component)
	metadata := controller.GetMetadata(controller.NodeAgent, hash, component, OrchestComponentKind)
	newDs, err := getNodeAgentDaemonset(registryIP, metadata, matchLabels, component)
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

func (reconciler *NodeAgentReconciler) Uninstall(ctx context.Context, component *orchestv1alpha1.OrchestComponent) (bool, error) {

	err := reconciler.Client().AppsV1().DaemonSets(component.Namespace).Delete(ctx, component.Name, metav1.DeleteOptions{})
	if err != nil && !kerrors.IsNotFound(err) {
		return false, err
	}

	return true, nil
}

func getNodeAgentDaemonset(registryIP string, metadata metav1.ObjectMeta,
	matchLabels map[string]string, component *orchestv1alpha1.OrchestComponent) (
	*appsv1.DaemonSet, error) {

	image := component.Spec.Template.Image

	var one int64 = 1

	socketPath := utils.GetKeyFromEnvVar(component.Spec.Template.Env, "CONTAINER_RUNTIME_SOCKET")
	hostPathSocket := corev1.HostPathType("Socket")

	containerRuntime := utils.GetKeyFromEnvVar(component.Spec.Template.Env, "CONTAINER_RUNTIME")

	// Necessary because the logic currently handling environment
	// variables does not support "ValueFrom" env variables. TO_DO fix
	// this.
	component.Spec.Template.Env = append(component.Spec.Template.Env, corev1.EnvVar{
		Name: "CLUSTER_NODE",
		ValueFrom: &corev1.EnvVarSource{
			FieldRef: &corev1.ObjectFieldSelector{
				FieldPath: "spec.nodeName",
			},
		},
	})

	template := corev1.PodTemplateSpec{
		ObjectMeta: metav1.ObjectMeta{
			Labels: matchLabels,
		},
		Spec: corev1.PodSpec{
			TerminationGracePeriodSeconds: &one,
			Volumes: []corev1.Volume{
				{
					Name: "runtimesocket",
					VolumeSource: corev1.VolumeSource{
						HostPath: &corev1.HostPathVolumeSource{
							Path: socketPath,
							Type: &hostPathSocket,
						},
					},
				},
			},
			Containers: []corev1.Container{
				{
					Name:            controller.NodeAgent,
					Image:           image,
					Env:             component.Spec.Template.Env,
					ImagePullPolicy: corev1.PullIfNotPresent,

					Command: []string{
						"python",
						"./app/main.py",
					},
					Args: []string{
						"--image-puller-log-level=INFO",
						"--image-puller-interval=60",
						"--image-puller-policy=IfNotPresent",
						"--image-puller-retries=3",
					},
					VolumeMounts: []corev1.VolumeMount{
						{
							Name:      "runtimesocket",
							MountPath: socketPath,
						},
					},
				},
			},
		},
	}

	// If container runtime is docker add required volumes to inject the certificates with lifecycle hooks
	if containerRuntime == "docker" {
		certificateDirectory := fmt.Sprintf("/etc/docker/certs.d/%s/", registryIP)

		template.Spec.Containers[0].Lifecycle = &corev1.Lifecycle{
			PostStart: &corev1.LifecycleHandler{
				Exec: &corev1.ExecAction{
					Command: []string{
						"/bin/sh",
						"-c",
						"mkdir -p " + certificateDirectory +
							" && cp /tls-secret/ca.crt " + certificateDirectory,
					},
				},
			},
			PreStop: &corev1.LifecycleHandler{
				Exec: &corev1.ExecAction{
					Command: []string{
						"/bin/sh",
						"-c",
						"rm -rf " + certificateDirectory,
					},
				},
			},
		}

		// The registry ca.crt also needs to be injected into the container
		template.Spec.Volumes = append(template.Spec.Volumes,
			corev1.Volume{
				Name: "tls-secret",
				VolumeSource: corev1.VolumeSource{
					Secret: &corev1.SecretVolumeSource{
						SecretName: "registry-tls-secret",
						Items: []corev1.KeyToPath{
							{
								Key:  "ca.crt",
								Path: "ca.crt",
							},
						},
					},
				},
			},
			corev1.Volume{
				Name: "docker-certs",
				VolumeSource: corev1.VolumeSource{
					HostPath: &corev1.HostPathVolumeSource{
						Path: "/etc/docker/certs.d",
					},
				},
			},
		)

		// And the secret needs to be mounted into the container
		template.Spec.Containers[0].VolumeMounts = append(template.Spec.Containers[0].VolumeMounts,
			corev1.VolumeMount{
				Name:      "tls-secret",
				MountPath: "/tls-secret/ca.crt",
				SubPath:   "ca.crt",
				ReadOnly:  true,
			},
			corev1.VolumeMount{
				Name:      "docker-certs",
				MountPath: "/etc/docker/certs.d",
			},
		)
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
