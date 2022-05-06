package orchestcluster

import (
	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

func getOrchetWebserverManifests(hash string, orchest *orchestv1alpha1.OrchestCluster) []client.Object {

	objects := make([]client.Object, 0, 3)
	matchLabels := getMatchLables(orchestWebserver, orchest)
	metadata := getMetadata(orchestWebserver, hash, orchest)

	objects = append(objects, getOrchetWebserverDeployment(metadata, matchLabels, orchest))
	objects = append(objects, getServiceManifest(metadata, matchLabels, 80, orchest))
	objects = append(objects, getIngressManifest(metadata, "/", true, orchest))

	return objects
}

func getOrchetWebserverDeployment(metadata metav1.ObjectMeta,
	matchLabels map[string]string, orchest *orchestv1alpha1.OrchestCluster) client.Object {

	image := orchest.Spec.Orchest.OrchestWebServer.Image

	envMap := utils.GetMapFromEnvVar(orchest.Spec.Orchest.Env, orchest.Spec.Orchest.OrchestWebServer.Env)

	env := utils.GetEnvVarFromMap(envMap)

	devMod := isDevelopmentEnabled(envMap)

	volumes := []corev1.Volume{
		{
			Name: userDirName,
			VolumeSource: corev1.VolumeSource{
				PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
					ClaimName: userDirName,
					ReadOnly:  false,
				},
			},
		},
	}

	volumeMounts := []corev1.VolumeMount{
		{
			Name:      userDirName,
			MountPath: userdirMountPath,
		},
	}

	if devMod {
		devVolumes, devVolumeMounts := getDevVolumes(orchestWebserver, true, true, true)
		volumes = append(volumes, devVolumes...)
		volumeMounts = append(volumeMounts, devVolumeMounts...)
	}

	template := corev1.PodTemplateSpec{
		ObjectMeta: metav1.ObjectMeta{
			Labels: matchLabels,
		},
		Spec: corev1.PodSpec{
			Volumes: volumes,
			Containers: []corev1.Container{
				{
					Name:            orchestWebserver,
					Image:           image,
					ImagePullPolicy: corev1.PullIfNotPresent,
					Ports: []corev1.ContainerPort{
						{
							ContainerPort: 80,
						},
					},
					Env:          env,
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

	return deployment
}
