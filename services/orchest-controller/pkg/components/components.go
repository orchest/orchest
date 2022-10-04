package components

import (
	"context"
	"fmt"
	"path"

	appsv1 "k8s.io/api/apps/v1"
	//corev1 "k8s.io/api/core/v1"
	//netsv1 "k8s.io/api/networking/v1"
	//kerrors "k8s.io/apimachinery/pkg/api/errors"
	//metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/certs"
	registry "github.com/orchest/orchest/services/orchest-controller/pkg/componentregistry"
	"github.com/orchest/orchest/services/orchest-controller/pkg/controller"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	"github.com/pkg/errors"
	appsinformers "k8s.io/client-go/informers/apps/v1"
	coreinformers "k8s.io/client-go/informers/core/v1"
	netsinformers "k8s.io/client-go/informers/networking/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/klog/v2"
)

// getRegistryServiceIP retrives the defined registry service IP from config
func getRegistryServiceIP(config *orchestv1alpha1.ApplicationConfig) (string, error) {
	for _, param := range config.Helm.Parameters {
		if param.Name == "service.clusterIP" {
			return param.Value, nil
		}
	}

	return "", errors.Errorf("registry service IP not found in config")
}

// This function is borrowed from projectcountour
func registryCertgen(ctx context.Context,
	client kubernetes.Interface,
	serviceIP, namespace string) error {
	generatedCerts, err := certs.GenerateCerts(
		&certs.Configuration{
			IP:        serviceIP,
			Lifetime:  365,
			Namespace: namespace,
		})
	if err != nil {
		klog.Error("failed to generate certificates")
		return err
	}

	if err := utils.OutputCerts(ctx, namespace, client, generatedCerts); err != nil {
		klog.Errorf("failed output certificates, error: %v", err)
		return err
	}

	return nil
}

func InitThirdPartyComponents(client kubernetes.Interface, config registry.ComponentsConfig) {

	registryPreInstalls := []preInstallHook{
		func(message registry.Message, namespace string, eventChan chan registry.Event) error {

			var err error

			defer func() {
				if err == nil {
					eventChan <- registry.LogEvent("Created docker-registry certificates")
				}
			}()

			app, ok := message.(*orchestv1alpha1.ApplicationSpec)
			if !ok {
				err = fmt.Errorf("Component requires message of type *orchestv1alpha1.ApplicationSpec")
				return err
			}

			eventChan <- registry.LogEvent("Creating docker-registry certificates")

			serviceIP, err := getRegistryServiceIP(&app.Config)
			if err != nil {
				return err
			}

			err = registryCertgen(context.Background(), client, serviceIP, namespace)
			return err
		},
	}

	dockerRegistryComponent := NewWrapperComponent(registry.DockerRegistry, registryPreInstalls,
		NewHelmComponent(client, registry.DockerRegistry,
			path.Join(config.AssetDir, "thirdparty/docker-registry/helm"),
			path.Join(config.AssetDir, "thirdparty/docker-registry/orchest-values.yaml")))

	registry.RegisterComponent(registry.DockerRegistry, dockerRegistryComponent)

	registry.RegisterComponent(registry.ArgoWorkflow, NewHelmComponent(client, registry.ArgoWorkflow,
		path.Join(config.AssetDir, "thirdparty/argo-workflows/helm"),
		path.Join(config.AssetDir, "thirdparty/argo-workflows/orchest-values.yaml")))

	registry.RegisterComponent(registry.IngressNginx, NewHelmComponent(client, registry.IngressNginx,
		path.Join(config.AssetDir, "thirdparty/ingress-nginx/helm"),
		path.Join(config.AssetDir, "thirdparty/ingress-nginx/orchest-values.yaml")))
}

func InitNativeComponents(stopCh <-chan struct{}, client kubernetes.Interface, svcInformer coreinformers.ServiceInformer,
	depInformer appsinformers.DeploymentInformer,
	dsInformer appsinformers.DaemonSetInformer,
	ingInformer netsinformers.IngressInformer) {

	orchestDatabase := NewNativeComponent[*appsv1.Deployment](controller.OrchestDatabase, stopCh,
		client, svcInformer, depInformer, dsInformer, ingInformer)

	orchestApi := NewNativeComponent[*appsv1.Deployment](controller.OrchestApi, stopCh,
		client, svcInformer, depInformer, dsInformer, ingInformer)

	orchestApiCleanup := NewNativeComponent[*appsv1.Deployment](controller.OrchestApiCleanup, stopCh,
		client, svcInformer, depInformer, dsInformer, ingInformer)

	rabbitmq := NewNativeComponent[*appsv1.Deployment](controller.Rabbitmq, stopCh,
		client, svcInformer, depInformer, dsInformer, ingInformer)

	celeryWorker := NewNativeComponent[*appsv1.Deployment](controller.CeleryWorker, stopCh,
		client, svcInformer, depInformer, dsInformer, ingInformer)

	authServer := NewNativeComponent[*appsv1.Deployment](controller.AuthServer, stopCh,
		client, svcInformer, depInformer, dsInformer, ingInformer)

	orchestWebserver := NewNativeComponent[*appsv1.Deployment](controller.OrchestWebserver, stopCh,
		client, svcInformer, depInformer, dsInformer, ingInformer)

	nodeAgent := NewNativeComponent[*appsv1.DaemonSet](controller.NodeAgent, stopCh,
		client, svcInformer, depInformer, dsInformer, ingInformer)

	buildKitDaemon := NewNativeComponent[*appsv1.DaemonSet](controller.BuildKitDaemon, stopCh,
		client, svcInformer, depInformer, dsInformer, ingInformer)

	registry.RegisterComponent(controller.OrchestDatabase, orchestDatabase)
	registry.RegisterComponent(controller.OrchestApi, orchestApi)
	registry.RegisterComponent(controller.OrchestApiCleanup, orchestApiCleanup)
	registry.RegisterComponent(controller.Rabbitmq, rabbitmq)
	registry.RegisterComponent(controller.CeleryWorker, celeryWorker)
	registry.RegisterComponent(controller.AuthServer, authServer)
	registry.RegisterComponent(controller.OrchestWebserver, orchestWebserver)
	registry.RegisterComponent(controller.NodeAgent, nodeAgent)
	registry.RegisterComponent(controller.BuildKitDaemon, buildKitDaemon)

}
