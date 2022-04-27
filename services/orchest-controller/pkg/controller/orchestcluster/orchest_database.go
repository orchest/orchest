package orchestcluster

import (
	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

func getOrchetDatabaseManifests(hash string, orchest *orchestv1alpha1.OrchestCluster) []client.Object {

	objects := make([]client.Object, 0, 2)
	matchLabels := getMatchLables(orchestDatabase, orchest)
	metadata := getMetadata(orchestDatabase, hash, orchest)

	objects = append(objects, getOrchetDatabaseDeployment(metadata, matchLabels, orchest))
	objects = append(objects, getServiceManifest(metadata, matchLabels, 5432, orchest))

	return objects
}

func getOrchetDatabaseDeployment(metadata metav1.ObjectMeta,
	matchLabels map[string]string, orchest *orchestv1alpha1.OrchestCluster) client.Object {

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
					Name:  orchestDatabase,
					Image: orchest.Spec.Postgres.Image,
					Ports: []corev1.ContainerPort{
						{
							ContainerPort: 5432,
						},
					},
					Env: orchest.Spec.Postgres.Env,
					VolumeMounts: []corev1.VolumeMount{
						{
							Name:      userDirName,
							MountPath: dbMountPath,
							SubPath:   dbSubPath,
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
