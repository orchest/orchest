package orchestcluster

import (
	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

func (d *OrchestReconciler) getCeleryWorkerManifests(orchest *orchestv1alpha1.OrchestCluster) (*appsv1.Deployment, []client.Object) {

	matchLabels := getMatchLables(celeryWorkerName, orchest)
	metadata := getMetadata(celeryWorkerName, orchest)

	var celeryWorkerImage string
	if orchest.Spec.Orchest.CeleryWorker.Image != "" {
		celeryWorkerImage = orchest.Spec.Orchest.CeleryWorker.Image
	} else {
		celeryWorkerImage = utils.GetFullImageName(orchest.Spec.Orchest.Registry,
			d.config.CeleryWorkerImageName, orchest.Spec.Orchest.DefaultTag)
	}

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
			ServiceAccountName: celeryWorkerName,
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
					Name:  celeryWorkerName,
					Image: celeryWorkerImage,
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
	rbacs := getRbacManifest(celeryWorkerName, metadata)

	return deployment, rbacs

}
