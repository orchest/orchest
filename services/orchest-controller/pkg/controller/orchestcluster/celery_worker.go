package orchestcluster

import (
	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func getCeleryWorkerManifests(hash string, orchest *orchestv1alpha1.OrchestCluster) (*appsv1.Deployment, *rbacv1.ClusterRole,
	*rbacv1.ClusterRoleBinding,
	*corev1.ServiceAccount) {

	matchLabels := getMatchLables(celeryWorker, orchest)
	metadata := getMetadata(celeryWorker, hash, orchest)

	image := orchest.Spec.Orchest.CeleryWorker.Image

	env := []corev1.EnvVar{
		{
			Name:  "ORCHEST_LOG_LEVEL",
			Value: "INFO",
		},
		{
			Name:  "PYTHONUNBUFFERED",
			Value: "TRUE",
		},
		{
			Name:  "ORCHEST_GPU_ENABLED_INSTANCE",
			Value: "FALSE",
		},
		{
			Name:  "MAX_JOB_RUNS_PARALLELISM",
			Value: "1",
		},
		{
			Name:  "MAX_INTERACTIVE_RUNS_PARALLELISM",
			Value: "1",
		},
		{
			Name:  "ORCHEST_HOST_GID",
			Value: "1",
		},
	}

	env = append(env, orchest.Spec.Orchest.Env...)
	env = append(env, orchest.Spec.Orchest.CeleryWorker.Env...)

	template := corev1.PodTemplateSpec{
		ObjectMeta: metav1.ObjectMeta{
			Labels: matchLabels,
		},
		Spec: corev1.PodSpec{
			ServiceAccountName: celeryWorker,
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
					Name:  celeryWorker,
					Image: image,
					Env:   env,
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

	// TODO: make it exactly what is needs, just in this namespace
	role, roleBinding, sa := getRbacManifest(metadata)

	return deployment, role, roleBinding, sa

}
