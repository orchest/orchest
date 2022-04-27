package orchestcluster

import (
	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

func getOrchestApiManifests(hash string, orchest *orchestv1alpha1.OrchestCluster) []client.Object {

	objects := make([]client.Object, 0, 5)
	matchLabels := getMatchLables(orchestApi, orchest)
	metadata := getMetadata(orchestApi, hash, orchest)

	objects = append(objects, getRbacManifest(metadata)...)
	objects = append(objects, getOrchetApiDeployment(metadata, matchLabels, orchest))
	objects = append(objects, getServiceManifest(metadata, matchLabels, 80, orchest))
	objects = append(objects, getIngressManifest(metadata, "/orchest-api", true, orchest))

	return objects
}

func getOrchetApiDeployment(metadata metav1.ObjectMeta,
	matchLabels map[string]string, orchest *orchestv1alpha1.OrchestCluster) client.Object {

	image := orchest.Spec.Orchest.OrchestApi.Image

	env := utils.MergeEnvVars(orchest.Spec.Orchest.Env, orchest.Spec.Orchest.OrchestApi.Env)

	template := corev1.PodTemplateSpec{
		ObjectMeta: metav1.ObjectMeta{
			Labels: matchLabels,
		},
		Spec: corev1.PodSpec{
			ServiceAccountName: orchestApi,
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
					Name:  orchestApi,
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
							MountPath: userdirMountPath,
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
