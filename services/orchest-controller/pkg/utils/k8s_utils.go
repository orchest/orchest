package utils

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/orchest/orchest/services/orchest-controller/pkg/client/clientset/versioned"
	ocinformersfactory "github.com/orchest/orchest/services/orchest-controller/pkg/client/informers/externalversions"
	orchestinformers "github.com/orchest/orchest/services/orchest-controller/pkg/client/informers/externalversions/orchest/v1alpha1"
	"github.com/pkg/errors"
	appsv1 "k8s.io/api/apps/v1"
	autoscalingv1 "k8s.io/api/autoscaling/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/informers"
	appsinformers "k8s.io/client-go/informers/apps/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/klog/v2"
)

func GetClientInsideCluster() kubernetes.Interface {
	config, err := rest.InClusterConfig()
	if err != nil {
		klog.Fatalf("Can not get kubernetes config: %v", err)
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		klog.Fatalf("Can not create kubernetes client: %v", err)
	}

	return clientset
}

// BuildOutsideClusterConfig returns k8s config
func BuildOutsideClusterConfig() (*rest.Config, error) {
	kubeConfig := GetEnvOrDefault("KUBECONFIG", "~/.kube/config")

	config, err := clientcmd.BuildConfigFromFlags("", kubeConfig)
	if err != nil {
		return nil, errors.Wrap(err, "faile to build")
	}
	return config, nil
}

// GetClientOutOfCluster returns a k8s clientset to the request from outside of cluster
func GetClientOutOfCluster() kubernetes.Interface {
	config, err := BuildOutsideClusterConfig()
	if err != nil {
		klog.Fatalf("Can not get kubernetes config: %v", err)
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		klog.Fatalf("Can not get kubernetes client: %v", err)
	}

	return clientset
}

func GetOrchClientInsideCluster() versioned.Interface {
	config, err := rest.InClusterConfig()
	if err != nil {
		klog.Fatalf("Can not get kubernetes client: %v", err)
	}

	orchClient, err := versioned.NewForConfig(config)
	if err != nil {
		klog.Fatalf("Can not get agent client: %v", err)
	}

	return orchClient
}

func GetOrchClientOutOfCluster() versioned.Interface {
	config, err := BuildOutsideClusterConfig()
	if err != nil {
		klog.Fatalf("Can not get kubernetes client: %v", err)
	}
	orchClient, err := versioned.NewForConfig(config)
	if err != nil {
		klog.Fatalf("Can not get orchest kubernetes client: %v", err)
	}

	return orchClient
}

func GetEnvOrDefault(key, defaultValue string) string {

	value := os.Getenv("KUBECONFIG")
	if value == "" {
		value = defaultValue
	}

	return value
}

func NewOrchestClusterInformer(ocClient versioned.Interface) orchestinformers.OrchestClusterInformer {
	orchestInformerFactory := ocinformersfactory.NewSharedInformerFactory(ocClient, time.Second*30)
	return orchestInformerFactory.Orchest().V1alpha1().OrchestClusters()
}

func NewDeploymentInformer(client kubernetes.Interface) appsinformers.DeploymentInformer {
	appsInformerFactory := informers.NewSharedInformerFactoryWithOptions(client, time.Second*30)
	return appsInformerFactory.Apps().V1().Deployments()
}

// IsDeploymentReady checks if the number of required replicas is equal to number of created replicas
func IsDeploymentReady(ctx context.Context, client kubernetes.Interface, name, namespace string) bool {

	deployment, err := client.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		if kerrors.IsNotFound(err) {
			klog.V(2).Info("deployment %s resource not found.", name)
		}
		// Error reading Deployment.
		return false
	}

	// Replicas is not intialized yet
	if deployment.Spec.Replicas == nil {
		return false
	}

	return *deployment.Spec.Replicas == deployment.Status.ReadyReplicas

}

func GetFullImageName(registry, imageName, tag string) string {
	if tag == "" {
		tag = "latest"
	}
	if registry != "" {
		return fmt.Sprintf("%s/orchest/%s:%s", registry, imageName, tag)
	}

	return fmt.Sprintf("orchest/%s:%s", imageName, tag)

}

func PauseDeployment(ctx context.Context,
	client kubernetes.Interface,
	deployment *appsv1.Deployment) error {

	scale := &autoscalingv1.Scale{
		Spec: autoscalingv1.ScaleSpec{
			Replicas: 0,
		},
	}

	_, err := client.AppsV1().Deployments(deployment.Namespace).UpdateScale(ctx, deployment.Name, scale, metav1.UpdateOptions{})
	if err != nil {
		return errors.Wrapf(err, "failed to pause a deployment %s", deployment.Name)
	}

	return nil
}
