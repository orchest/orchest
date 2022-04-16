package orchestcluster

import (
	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func (d *OrchestDeployer) getAuthServerManifest(orchest *orchestv1alpha1.OrchestCluster) *appsv1.Deployment {

	matchLabels := getMatchLables(authServerName, orchest)
	metadata := getMetadata(authServerName, orchest)

	var image string
	if orchest.Spec.Orchest.AuthServer.Image != "" {
		image = orchest.Spec.Orchest.AuthServer.Image
	} else {
		image = utils.GetFullImageName(orchest.Spec.Orchest.Registry,
			d.config.AuthServerImageName, orchest.Spec.Orchest.DefaultTag)
	}

	env := []corev1.EnvVar{
		{
			Name:  "ORCHEST_HOST_GID",
			Value: "1",
		},
		{
			Name:  "PYTHONUNBUFFERED",
			Value: "TRUE",
		},
	}

	env = append(env, orchest.Spec.Orchest.Env...)
	env = append(env, orchest.Spec.Orchest.AuthServer.Env...)

	template := corev1.PodTemplateSpec{
		ObjectMeta: metav1.ObjectMeta{
			Labels: matchLabels,
		},
		Spec: corev1.PodSpec{
			Volumes: []corev1.Volume{
				{
					Name: configDirName,
					VolumeSource: corev1.VolumeSource{
						PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
							ClaimName: configDirName,
							ReadOnly:  false,
						},
					},
				},
			},
			Containers: []corev1.Container{
				{
					Name:  authServerName,
					Image: image,
					Ports: []corev1.ContainerPort{
						{
							ContainerPort: 80,
						},
					},
					Env: env,
					VolumeMounts: []corev1.VolumeMount{
						{
							Name:      configDirName,
							MountPath: configdirMountPath,
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
