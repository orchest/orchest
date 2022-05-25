package orchestcomponent

import (
	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/controller"
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

	hash := controller.ComputeHash(component)
	matchLabels := controller.GetResourceMatchLables(controller.NodeAgent, component)
	metadata := controller.GetMetadata(controller.NodeAgent, hash, component, OrchestComponentKind)
	newDs := getNodeAgentDaemonset(metadata, matchLabels, component)

	_, err := reconciler.dsLister.DaemonSets(component.Namespace).Get(component.Name)
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

func getNodeAgentDaemonset(metadata metav1.ObjectMeta,
	matchLabels map[string]string, component *orchestv1alpha1.OrchestComponent) *appsv1.DaemonSet {

	image := component.Spec.Template.Image

	var one int64 = 1

	template := corev1.PodTemplateSpec{
		ObjectMeta: metav1.ObjectMeta{
			Labels: matchLabels,
		},
		Spec: corev1.PodSpec{
			TerminationGracePeriodSeconds: &one,
			Volumes: []corev1.Volume{
				{
					Name: "dockersock",
					VolumeSource: corev1.VolumeSource{
						HostPath: &corev1.HostPathVolumeSource{
							Path: "/var/run/docker.sock",
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
							Name:      "dockersock",
							MountPath: "/var/run/docker.sock",
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

	return daemonSet

}
