package orchestcluster

import (
	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

func getNodeAgentManifests(hash string, orchest *orchestv1alpha1.OrchestCluster) []client.Object {

	objects := make([]client.Object, 0, 2)
	matchLabels := getMatchLables(nodeAgentName, orchest)
	metadata := getMetadata(nodeAgentName, hash, orchest)

	objects = append(objects, getNodeAgentDaemonset(metadata, matchLabels, orchest))

	return objects
}

func getNodeAgentDaemonset(metadata metav1.ObjectMeta,
	matchLabels map[string]string, orchest *orchestv1alpha1.OrchestCluster) client.Object {

	image := orchest.Spec.Orchest.NodeAgent.Image

	env := utils.MergeEnvVars(orchest.Spec.Orchest.Env, orchest.Spec.Orchest.NodeAgent.Env)

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
					Name:  nodeAgentName,
					Image: image,
					Env:   env,
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

	deployment := &appsv1.DaemonSet{
		ObjectMeta: metadata,
		Spec: appsv1.DaemonSetSpec{
			Selector: &metav1.LabelSelector{
				MatchLabels: matchLabels,
			},
			Template: template,
		},
	}

	return deployment

}
