package orchestcluster

import (
	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

func (d *OrchestDeployer) getOrchetApiManifest(orchest *orchestv1alpha1.OrchestCluster) (*appsv1.Deployment, []client.Object) {

	matchLabels := getMatchLables(orchestApiName, orchest)
	metadata := getMetadata(orchestApiName, orchest)

	var orchestApiImage string
	if orchest.Spec.Orchest.OrchestApi.Image != "" {
		orchestApiImage = orchest.Spec.Orchest.OrchestApi.Image
	} else {
		orchestApiImage = utils.GetFullImageName(orchest.Spec.Orchest.Registry,
			d.config.OrchestApiImageName, orchest.Spec.Orchest.DefaultTag)
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
		{
			Name:  "ORCHEST_GPU_ENABLED_INSTANCE",
			Value: "FALSE",
		},
	}

	env = append(env, orchest.Spec.Orchest.Env...)
	env = append(env, orchest.Spec.Orchest.OrchestApi.Env...)

	template := corev1.PodTemplateSpec{
		ObjectMeta: metav1.ObjectMeta{
			Labels: matchLabels,
		},
		Spec: corev1.PodSpec{
			ServiceAccountName: orchestApiName,
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
					Name:  orchestApiName,
					Image: orchestApiImage,
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

	// TODO: make it exactly what is needs, just in this namespace
	rbacs := getRbacManifest(orchestApiImage, metadata)

	return deployment, rbacs

}
