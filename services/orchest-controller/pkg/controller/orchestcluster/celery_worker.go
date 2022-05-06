package orchestcluster

import (
	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

func getCeleryWorkerManifests(hash string, orchest *orchestv1alpha1.OrchestCluster) []client.Object {

	objects := make([]client.Object, 0, 4)
	matchLabels := getMatchLables(celeryWorker, orchest)
	metadata := getMetadata(celeryWorker, hash, orchest)

	objects = append(objects, getRbacManifest(metadata)...)
	objects = append(objects, getCeleryWorkerDeployment(metadata, matchLabels, orchest))

	return objects
}

func getCeleryWorkerDeployment(metadata metav1.ObjectMeta,
	matchLabels map[string]string, orchest *orchestv1alpha1.OrchestCluster) client.Object {

	image := orchest.Spec.Orchest.CeleryWorker.Image

	env := utils.MergeEnvVars(orchest.Spec.Orchest.Env, orchest.Spec.Orchest.CeleryWorker.Env)

	/*
				        - name: tls-secret
		          secret:
		            secretName: registry-tls-secret
		            items:
		              - key: ca.crt
		                path: additional-ca-cert-bundle.crt
	*/

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
				{
					Name: "tls-secret",
					VolumeSource: corev1.VolumeSource{
						Secret: &corev1.SecretVolumeSource{
							SecretName: "registry-tls-secret",
							Items: []corev1.KeyToPath{
								{
									Key:  "ca.crt",
									Path: "additional-ca-cert-bundle.crt",
								},
							},
						},
					},
				},
			},
			Containers: []corev1.Container{
				{
					Name:            celeryWorker,
					Image:           image,
					Env:             env,
					ImagePullPolicy: corev1.PullIfNotPresent,
					VolumeMounts: []corev1.VolumeMount{
						{
							Name:      userDirName,
							MountPath: userdirMountPath,
						},
						{
							Name:      "tls-secret",
							MountPath: "/usr/lib/ssl/certs/additional-ca-cert-bundle.crt",
							SubPath:   "additional-ca-cert-bundle.crt",
							ReadOnly:  true,
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
				Type: appsv1.RecreateDeploymentStrategyType,
			},
		},
	}

	// TODO: make it exactly what is needs, just in this namespace
	//role, roleBinding, sa := getRbacManifest(metadata)

	return deployment
}
