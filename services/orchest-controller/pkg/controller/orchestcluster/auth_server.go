package orchestcluster

import (
	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

func getAuthServerManifests(hash string, orchest *orchestv1alpha1.OrchestCluster) []client.Object {

	objects := make([]client.Object, 0, 2)
	matchLabels := getMatchLables(authServer, orchest)
	metadata := getMetadata(authServer, hash, orchest)

	objects = append(objects, getAuthServerDeployment(metadata, matchLabels, orchest))
	objects = append(objects, getServiceManifest(metadata, matchLabels, 80, orchest))
	objects = append(objects, getIngressManifest(metadata, "/login", false, false, orchest))

	return objects
}

func getAuthServerDeployment(metadata metav1.ObjectMeta,
	matchLabels map[string]string, orchest *orchestv1alpha1.OrchestCluster) client.Object {

	image := orchest.Spec.Orchest.AuthServer.Image

	envMap := utils.GetMapFromEnvVar(orchest.Spec.Orchest.Env, orchest.Spec.Orchest.AuthServer.Env)

	env := utils.GetEnvVarFromMap(envMap)

	template := corev1.PodTemplateSpec{
		ObjectMeta: metav1.ObjectMeta{
			Labels: matchLabels,
		},
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{
				{
					Name:            authServer,
					Image:           image,
					ImagePullPolicy: corev1.PullIfNotPresent,
					Ports: []corev1.ContainerPort{
						{
							ContainerPort: 80,
						},
					},
					Env: env,
				},
			},
		},
	}

	devMod := isDevelopmentEnabled(envMap)

	if devMod {
		volumes, volumeMounts := getDevVolumes(authServer, true, true, true)
		template.Spec.Volumes = volumes
		template.Spec.Containers[0].VolumeMounts = volumeMounts
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
