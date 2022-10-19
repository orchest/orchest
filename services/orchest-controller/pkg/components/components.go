package components

import (
	"context"
	"fmt"
	"path"

	appsv1 "k8s.io/api/apps/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"

	//corev1 "k8s.io/api/core/v1"
	//netsv1 "k8s.io/api/networking/v1"
	//kerrors "k8s.io/apimachinery/pkg/api/errors"
	//metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/certs"
	registry "github.com/orchest/orchest/services/orchest-controller/pkg/componentregistry"
	"github.com/orchest/orchest/services/orchest-controller/pkg/components/reconcilers"
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

	registry.RegisterComponent(registry.NvidiaPlugin, NewHelmComponent(client, registry.NvidiaPlugin,
		path.Join(config.AssetDir, "thirdparty/nvidia-device-plugin/helm"),
		path.Join(config.AssetDir, "thirdparty/nvidia-device-plugin/orchest-values.yaml")))
}

func InitOrchestComponents(stopCh <-chan struct{}, client kubernetes.Interface, gClient client.Client,
	svcInformer coreinformers.ServiceInformer,
	depInformer appsinformers.DeploymentInformer,
	dsInformer appsinformers.DaemonSetInformer,
	ingInformer netsinformers.IngressInformer) {

	resourcesComponent := newResourcesComponent(controller.Resources, client, gClient)
	databaseComponent := newOrchestDatabaseComponent(stopCh, client, svcInformer, depInformer, dsInformer, ingInformer)
	rabbitmqComponent := newRabbitmqComponent(stopCh, client, svcInformer, depInformer, dsInformer, ingInformer)
	orchestApiComponent := newOrchestApiComponent(stopCh, client, svcInformer, depInformer, dsInformer, ingInformer)
	celeryWorkerComponent := newCeleryWorkerComponent(stopCh, client, svcInformer, depInformer, dsInformer, ingInformer)
	authServerComponent := newAuthServerComponent(stopCh, client, svcInformer, depInformer, dsInformer, ingInformer)
	orchestWebserverComponent := newOrchestWebserverComponent(stopCh, client, svcInformer, depInformer, dsInformer, ingInformer)
	nodeAgentComponent := newNodeAgentComponent(stopCh, client, svcInformer, depInformer, dsInformer, ingInformer)
	buildKitDaemonComponent := newBuildKitDaemonComponent(stopCh, client, svcInformer, depInformer, dsInformer, ingInformer)

	registry.RegisterComponent(controller.Resources, resourcesComponent)
	registry.RegisterComponent(controller.OrchestDatabase, databaseComponent)
	registry.RegisterComponent(controller.Rabbitmq, rabbitmqComponent)
	registry.RegisterComponent(controller.OrchestApi, orchestApiComponent)
	registry.RegisterComponent(controller.CeleryWorker, celeryWorkerComponent)
	registry.RegisterComponent(controller.AuthServer, authServerComponent)
	registry.RegisterComponent(controller.OrchestWebserver, orchestWebserverComponent)
	registry.RegisterComponent(controller.NodeAgent, nodeAgentComponent)
	registry.RegisterComponent(controller.BuildKitDaemon, buildKitDaemonComponent)

	//registry.RegisterComponent(controller.OrchestApiCleanup, orchestApiCleanup)
}

func newOrchestDatabaseComponent(stopCh <-chan struct{}, client kubernetes.Interface, svcInformer coreinformers.ServiceInformer,
	depInformer appsinformers.DeploymentInformer,
	dsInformer appsinformers.DaemonSetInformer,
	ingInformer netsinformers.IngressInformer) registry.Component {

	ctrl := controller.NewController[*appsv1.Deployment](controller.OrchestDatabase, 1, client, nil)

	reconciler := reconcilers.NewOrchestDatabaseReconciler(ctrl)

	component := NewNativeComponent(controller.OrchestDatabase, stopCh,
		client, ctrl, reconciler, svcInformer, depInformer, dsInformer, ingInformer)

	return component
}

func newRabbitmqComponent(stopCh <-chan struct{}, client kubernetes.Interface, svcInformer coreinformers.ServiceInformer,
	depInformer appsinformers.DeploymentInformer,
	dsInformer appsinformers.DaemonSetInformer,
	ingInformer netsinformers.IngressInformer) registry.Component {

	ctrl := controller.NewController[*appsv1.Deployment](controller.Rabbitmq, 1, client, nil)

	reconciler := reconcilers.NewRabbitmqServerReconciler(ctrl)

	component := NewNativeComponent(controller.Rabbitmq, stopCh,
		client, ctrl, reconciler, svcInformer, depInformer, dsInformer, ingInformer)

	return component
}

func newOrchestApiComponent(stopCh <-chan struct{}, client kubernetes.Interface, svcInformer coreinformers.ServiceInformer,
	depInformer appsinformers.DeploymentInformer,
	dsInformer appsinformers.DaemonSetInformer,
	ingInformer netsinformers.IngressInformer) registry.Component {

	ctrl := controller.NewController[*appsv1.Deployment](controller.OrchestApi, 1, client, nil)

	reconciler := reconcilers.NewOrchestApiReconciler(ctrl)

	component := NewNativeComponent(controller.OrchestApi, stopCh,
		client, ctrl, reconciler, svcInformer, depInformer, dsInformer, ingInformer)

	return component
}

func newCeleryWorkerComponent(stopCh <-chan struct{}, client kubernetes.Interface, svcInformer coreinformers.ServiceInformer,
	depInformer appsinformers.DeploymentInformer,
	dsInformer appsinformers.DaemonSetInformer,
	ingInformer netsinformers.IngressInformer) registry.Component {

	ctrl := controller.NewController[*appsv1.Deployment](controller.CeleryWorker, 1, client, nil)

	reconciler := reconcilers.NewCeleryWorkerReconciler(ctrl)

	component := NewNativeComponent(controller.CeleryWorker, stopCh,
		client, ctrl, reconciler, svcInformer, depInformer, dsInformer, ingInformer)

	return component
}

func newAuthServerComponent(stopCh <-chan struct{}, client kubernetes.Interface, svcInformer coreinformers.ServiceInformer,
	depInformer appsinformers.DeploymentInformer,
	dsInformer appsinformers.DaemonSetInformer,
	ingInformer netsinformers.IngressInformer) registry.Component {

	ctrl := controller.NewController[*appsv1.Deployment](controller.AuthServer, 1, client, nil)

	reconciler := reconcilers.NewAuthServerReconciler(ctrl)

	component := NewNativeComponent(controller.AuthServer, stopCh,
		client, ctrl, reconciler, svcInformer, depInformer, dsInformer, ingInformer)

	return component
}

func newOrchestWebserverComponent(stopCh <-chan struct{}, client kubernetes.Interface, svcInformer coreinformers.ServiceInformer,
	depInformer appsinformers.DeploymentInformer,
	dsInformer appsinformers.DaemonSetInformer,
	ingInformer netsinformers.IngressInformer) registry.Component {

	ctrl := controller.NewController[*appsv1.Deployment](controller.OrchestWebserver, 1, client, nil)

	reconciler := reconcilers.NewOrchestWebServerReconciler(ctrl)

	component := NewNativeComponent(controller.OrchestWebserver, stopCh,
		client, ctrl, reconciler, svcInformer, depInformer, dsInformer, ingInformer)

	return component
}

func newNodeAgentComponent(stopCh <-chan struct{}, client kubernetes.Interface, svcInformer coreinformers.ServiceInformer,
	depInformer appsinformers.DeploymentInformer,
	dsInformer appsinformers.DaemonSetInformer,
	ingInformer netsinformers.IngressInformer) registry.Component {

	ctrl := controller.NewController[*appsv1.DaemonSet](controller.NodeAgent, 1, client, nil)

	reconciler := reconcilers.NewNodeAgentReconciler(ctrl)

	component := NewNativeComponent(controller.NodeAgent, stopCh,
		client, ctrl, reconciler, svcInformer, depInformer, dsInformer, ingInformer)

	return component
}

func newBuildKitDaemonComponent(stopCh <-chan struct{}, client kubernetes.Interface, svcInformer coreinformers.ServiceInformer,
	depInformer appsinformers.DeploymentInformer,
	dsInformer appsinformers.DaemonSetInformer,
	ingInformer netsinformers.IngressInformer) registry.Component {

	ctrl := controller.NewController[*appsv1.DaemonSet](controller.BuildKitDaemon, 1, client, nil)

	reconciler := reconcilers.NewBuildKitDaemonReconciler(ctrl)

	component := NewNativeComponent(controller.BuildKitDaemon, stopCh,
		client, ctrl, reconciler, svcInformer, depInformer, dsInformer, ingInformer)

	return component
}
