package orchestcluster

import (
	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func getOrchetWebserverManifest(hash string, orchest *orchestv1alpha1.OrchestCluster) *appsv1.Deployment {

	matchLabels := getMatchLables(orchestWebserver, orchest)
	metadata := getMetadata(orchestWebserver, hash, orchest)

	image := orchest.Spec.Orchest.OrchestWebServer.Image

	env := []corev1.EnvVar{
		{
			Name:  "ORCHEST_HOST_GID",
			Value: "1",
		},
		{
			Name:  "PYTHONUNBUFFERED",
			Value: "TRUE",
		},
		{
			Name:  "ORCHEST_GPU_ENABLED_INSTANCE",
			Value: "FALSE",
		},
	}

	env = append(env, orchest.Spec.Orchest.Env...)
	env = append(env, orchest.Spec.Orchest.OrchestWebServer.Env...)

	template := corev1.PodTemplateSpec{
		ObjectMeta: metav1.ObjectMeta{
			Labels: matchLabels,
		},
		Spec: corev1.PodSpec{
			Volumes: []corev1.Volume{
				{
					Name: userDirName,
					VolumeSource: corev1.VolumeSource{
						PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
							ClaimName: userDirName,
							ReadOnly:  false,
						},
					},
				},
			},
			Containers: []corev1.Container{
				{
					Name:  orchestWebserver,
					Image: image,
					Ports: []corev1.ContainerPort{
						{
							ContainerPort: 80,
						},
					},
					Env: env,
					VolumeMounts: []corev1.VolumeMount{
						{
							Name:      userDirName,
							MountPath: userDirName,
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
				RollingUpdate: &appsv1.RollingUpdateDeployment{
					MaxUnavailable: &Zero,
				},
			},
		},
	}

	return deployment
}
