package orchestcluster

import (
	"fmt"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
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

func getCleanupManifests(orchest *orchestv1alpha1.OrchestCluster) []client.Object {

	generation := fmt.Sprint(orchest.Generation)
	objects := make([]client.Object, 0, 5)
	matchLabels := getMatchLables(orchestApiCleanup, orchest)
	metadata := getMetadata(orchestApiCleanup, generation, orchest)

	objects = append(objects, getCleanupPod(metadata, matchLabels, orchest))

	return objects
}

func getOrchetApiDeployment(metadata metav1.ObjectMeta,
	matchLabels map[string]string, orchest *orchestv1alpha1.OrchestCluster) client.Object {

	image := orchest.Spec.Orchest.OrchestApi.Image

	envMap := utils.GetMapFromEnvVar(orchest.Spec.Orchest.Env, orchest.Spec.Orchest.OrchestApi.Env)
	env := utils.GetEnvVarFromMap(envMap)

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
	}

	volumeMounts := []corev1.VolumeMount{
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
	}

	devMod := isDevelopmentEnabled(envMap)
	if devMod {
		devVolumes, devVolumeMounts := getDevVolumes(orchestApi, true, false, true)
		volumes = append(volumes, devVolumes...)
		volumeMounts = append(volumeMounts, devVolumeMounts...)
	}

	template := corev1.PodTemplateSpec{
		ObjectMeta: metav1.ObjectMeta{
			Labels: matchLabels,
		},
		Spec: corev1.PodSpec{
			ServiceAccountName: orchestApi,
			Volumes:            volumes,
			Containers: []corev1.Container{
				{
					Name:            orchestApi,
					Image:           image,
					ImagePullPolicy: corev1.PullIfNotPresent,
					Ports: []corev1.ContainerPort{
						{
							ContainerPort: 80,
						},
					},
					Env:          env,
					VolumeMounts: volumeMounts,
					ReadinessProbe: &corev1.Probe{
						ProbeHandler: corev1.ProbeHandler{
							HTTPGet: &corev1.HTTPGetAction{
								Path:   "/api",
								Port:   intstr.FromInt(80),
								Scheme: corev1.URISchemeHTTP,
							},
						},
						PeriodSeconds:    10,
						TimeoutSeconds:   2,
						SuccessThreshold: 1,
						FailureThreshold: 5,
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

func getCleanupPod(metadata metav1.ObjectMeta,
	matchLabels map[string]string, orchest *orchestv1alpha1.OrchestCluster) client.Object {

	image := orchest.Spec.Orchest.OrchestApi.Image

	env := utils.MergeEnvVars(orchest.Spec.Orchest.Env, orchest.Spec.Orchest.OrchestApi.Env)

	pod := &corev1.Pod{
		ObjectMeta: metadata,
		Spec: corev1.PodSpec{
			RestartPolicy:      corev1.RestartPolicyNever,
			ServiceAccountName: orchestApi,
			Containers: []corev1.Container{
				{
					Name: metadata.Name,
					Command: []string{
						"/bin/sh", "-c",
					},
					Args: []string{
						"python migration_manager.py db migrate && python cleanup.py",
					},
					Image: image,
					Env:   env,
				},
			},
		},
	}

	return pod
}
