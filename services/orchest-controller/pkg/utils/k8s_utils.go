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
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/client-go/informers"
	appsinformers "k8s.io/client-go/informers/apps/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/klog/v2"
	"sigs.k8s.io/controller-runtime/pkg/client"
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

func NewDeploymentInformer(client kubernetes.Interface) appsinformers.DaemonSetInformer {
	appsInformerFactory := informers.NewSharedInformerFactoryWithOptions(client, time.Second*30)
	return appsInformerFactory.Apps().V1().DaemonSets()
}

func contains(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}

	return false
}

func remove(list []string, s string) []string {
	for i, v := range list {
		if v == s {
			return append(list[:i], list[i+1:]...)
		}
	}
	return list
}

// AddFinalizer adds specified finalizer string to object
func AddFinalizerIfNotPresent(ctx context.Context, client client.Client, obj client.Object, finalizer string) error {

	accessor, err := meta.Accessor(obj)
	if err != nil {
		return errors.Wrap(err, "failed to get meta information of object")
	}

	if !contains(accessor.GetFinalizers(), finalizer) {
		klog.Infof("Failed to get finalizers to object %q", accessor.GetName())
		accessor.SetFinalizers(append(accessor.GetFinalizers(), finalizer))

		if err := client.Update(ctx, obj); err != nil {
			return errors.Wrapf(err, "failed to add finalizer %q on %q", finalizer, accessor.GetName())
		}
	}

	return nil
}

// RemoveFinalizers removes finalizersfrom object
func RemoveFinalizerIfNotPresent(ctx context.Context, client client.Client, obj client.Object, finalizer string) error {

	accessor, err := meta.Accessor(obj)
	if err != nil {
		return errors.Wrap(err, "failed to get meta information of object")
	}

	finalizers := remove(accessor.GetFinalizers(), finalizer)
	accessor.SetFinalizers(finalizers)

	if err := client.Update(ctx, obj); err != nil {
		return errors.Wrapf(err, "failed to remove finalizer %q on %q", finalizer, accessor.GetName())
	}

	return nil
}

func RunningPodsForDeployment(ctx context.Context, client client.Client, depKey client.ObjectKey) (int, error) {

	deployment := &appsv1.Deployment{}
	err := client.Get(ctx, depKey, deployment)
	if err != nil {
		if kerrors.IsNotFound(err) {
			klog.V(2).Info("deployment %s resource not found.", depKey)
			return 0, nil
		}
		// Error reading Deployment.
		return 0, errors.Wrap(err, "failed to get OrchestCluster")
	}

	return int(deployment.Status.ReadyReplicas), nil

}

func GetFullImageName(registry, imageName, tag string) string {
	if tag == "" {
		tag = "latest"
	}
	if registry != "" {
		return fmt.Sprintf("%s/%s:%s", registry, imageName, tag)
	}

	return fmt.Sprintf("%s:%s", imageName, tag)

}
