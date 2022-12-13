package cmd

import (
	"os"
	"os/signal"
	"syscall"

	"github.com/orchest/orchest/services/orchest-controller/pkg/addons"
	"github.com/orchest/orchest/services/orchest-controller/pkg/controller/minikubereconciler"
	"github.com/orchest/orchest/services/orchest-controller/pkg/controller/orchestcluster"
	"github.com/orchest/orchest/services/orchest-controller/pkg/controller/orchestcomponent"
	"github.com/orchest/orchest/services/orchest-controller/pkg/server"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	"github.com/orchest/orchest/services/orchest-controller/pkg/version"
	"github.com/spf13/cobra"
	"k8s.io/klog/v2"
)

var (
	inCluster        = true
	controllerConfig = orchestcluster.NewDefaultControllerConfig()
	serverConfig     = server.NewDefaultServerConfig()
	addonsConfig     = addons.NewDefaultAddonsConfig()
)

func NewControllerCommand() *cobra.Command {

	cmd := &cobra.Command{
		Use:   "orchest [options]",
		Short: "starts orchest operator",
		Long:  "starts orchest operator",
		Run: func(cmd *cobra.Command, args []string) {
			err := runControllerCmd()
			if err != nil {
				klog.Error(err)
			}
		},
	}

	cmd.PersistentFlags().StringVar(&controllerConfig.PostgresDefaultImage,
		"postgresImage", controllerConfig.PostgresDefaultImage, "The default postgres image if not provided in CR")

	cmd.PersistentFlags().StringVar(&controllerConfig.RabbitmqDefaultImage,
		"rabbitmqImage", controllerConfig.RabbitmqDefaultImage, "The default rabbitmq image if not provided in CR")

	cmd.PersistentFlags().StringVar(&controllerConfig.UserdirDefaultVolumeSize,
		"userdirSize", controllerConfig.UserdirDefaultVolumeSize, "The default size for userdir pvc")

	cmd.PersistentFlags().StringVar(&controllerConfig.OrchestStateDefaultVolumeSize,
		"orchestStateVolumeSize", controllerConfig.OrchestStateDefaultVolumeSize, "The default size for the Orchest state pvc if exists")

	cmd.PersistentFlags().StringVar(&controllerConfig.BuilddirDefaultVolumeSize,
		"builderSize", controllerConfig.BuilddirDefaultVolumeSize, "The default size for builddir pvc")

	cmd.PersistentFlags().StringVar(&controllerConfig.OrchestDefaultVersion,
		"defaultVersion", version.Version, "The default version for orchest components")

	cmd.PersistentFlags().BoolVar(&controllerConfig.DefaultPause,
		"pause", controllerConfig.DefaultPause, "Default Orchest Cluster pause state")

	cmd.PersistentFlags().StringVar(&controllerConfig.CeleryWorkerImageName,
		"celeryImageName", controllerConfig.CeleryWorkerImageName, "The default celery-worker image name")

	cmd.PersistentFlags().StringVar(&controllerConfig.OrchestApiImageName,
		"orchestApiImageName", controllerConfig.OrchestApiImageName, "The default orchest-api image name")

	cmd.PersistentFlags().StringVar(&controllerConfig.OrchestWebserverImageName,
		"webserverImageName", controllerConfig.OrchestWebserverImageName, "The default orchest-webserver image name")

	cmd.PersistentFlags().StringVar(&controllerConfig.AuthServerImageName,
		"authServerImageName", controllerConfig.AuthServerImageName, "The default auth server image name")

	cmd.PersistentFlags().StringToStringVar(&controllerConfig.OrchestDefaultEnvVars,
		"envVars", controllerConfig.OrchestDefaultEnvVars, "The default env vars for orchest components")

	cmd.PersistentFlags().StringToStringVar(&controllerConfig.OrchestApiDefaultEnvVars,
		"orchestApiEnvVars", controllerConfig.OrchestApiDefaultEnvVars, "The default env vars for orchest-api")

	cmd.PersistentFlags().StringToStringVar(&controllerConfig.OrchestWebserverDefaultEnvVars,
		"webServerEnvVars", controllerConfig.OrchestWebserverDefaultEnvVars, "The default env vars for orchest-webserver")

	cmd.PersistentFlags().StringToStringVar(&controllerConfig.AuthServerDefaultEnvVars,
		"authServerEnvVars", controllerConfig.AuthServerDefaultEnvVars, "The default env vars for auth-webserver")

	cmd.PersistentFlags().StringToStringVar(&controllerConfig.CeleryWorkerDefaultEnvVars,
		"celeryWorkerEnvVars", controllerConfig.CeleryWorkerDefaultEnvVars, "The default env vars for celery-worker")

	cmd.PersistentFlags().StringToStringVar(&controllerConfig.OrchestDatabaseDefaultEnvVars,
		"dbEnvVars", controllerConfig.OrchestDatabaseDefaultEnvVars, "The default env vars for orchest-database")

	cmd.PersistentFlags().StringToStringVar(&controllerConfig.RabbitmqDefaultEnvVars,
		"rabbitVars", controllerConfig.RabbitmqDefaultEnvVars, "The default env vars for rabbitmq-server")

	cmd.PersistentFlags().IntVar(&controllerConfig.Threadiness,
		"threadiness", controllerConfig.Threadiness, "threadiness of the controller")

	cmd.PersistentFlags().StringVar(&serverConfig.Endpoint,
		"endpoint", serverConfig.Endpoint, "The endpoint of Http Server")

	cmd.PersistentFlags().StringArrayVar(&addonsConfig.Addons, "enable", addonsConfig.Addons,
		"Default addons to enable on orchest-controller installation")

	cmd.PersistentFlags().StringVar(&addonsConfig.AssetDir,
		"assetDir", addonsConfig.AssetDir, "The directory of assets")

	cmd.PersistentFlags().StringVar(&addonsConfig.DefaultNamespace,
		"namespace", addonsConfig.DefaultNamespace, "The default namespace for installing addons")

	cmd.PersistentFlags().BoolVar(&inCluster,
		"inCluster", true, "In/Out cluster indicator")

	return cmd
}

func runControllerCmd() error {
	klog.Info("running orchest controller")

	stopCh := make(chan struct{})
	defer close(stopCh)

	// Initialize scheme
	scheme := utils.GetScheme()

	// Initialize clients
	kClient, oClient, gClient := utils.GetClientsOrDie(inCluster, scheme)
	// Create Shared Informer Factory
	informerFactory := utils.NewInformerFactory(kClient)
	// Create Service Informer
	svcInformer := utils.NewServiceInformer(informerFactory)
	// Create Deployment Informer
	depInformer := utils.NewDeploymentInformer(informerFactory)
	// Create Daemonset Informer
	dsInformer := utils.NewDaemonSetInformer(informerFactory)
	// Create Ingress Informer
	ingInformer := utils.NewIngressInformer(informerFactory)

	oClusterInformer := utils.NewOrchestClusterInformer(oClient)

	//Create OrchestCluster Informer
	oComponentInformer := utils.NewOrchestComponentInformer(oClient)

	addonManager := addons.NewAddonManager(kClient, addonsConfig)

	k8sDistro := utils.DetectK8sDistribution(kClient)

	oClusterController := orchestcluster.NewOrchestClusterController(kClient,
		oClient,
		gClient,
		scheme,
		controllerConfig,
		k8sDistro,
		oClusterInformer,
		oComponentInformer,
		addonManager)

	oComponentController := orchestcomponent.NewOrchestComponentController(kClient,
		oClient,
		gClient,
		scheme,
		oComponentInformer,
		svcInformer,
		depInformer,
		dsInformer,
		ingInformer)

	server := server.NewServer(serverConfig, oClusterInformer)

	if k8sDistro == utils.Minikube {
		minikubeReconciler := minikubereconciler.NewMinikubeReconcilerController(kClient, depInformer)
		go minikubeReconciler.Run(stopCh)
	}

	// Start the addon manager
	go addonManager.Run(stopCh)

	// Start Orchest Controllers
	go oClusterController.Run(stopCh)
	go oComponentController.Run(stopCh)

	// Start Orchest Objests Informer
	go oClusterInformer.Informer().Run(stopCh)
	go oComponentInformer.Informer().Run(stopCh)

	// Start Kubernetes Objects Informers
	go depInformer.Informer().Run(stopCh)
	go dsInformer.Informer().Run(stopCh)
	go svcInformer.Informer().Run(stopCh)
	go ingInformer.Informer().Run(stopCh)

	// Start webserver
	go server.Run(stopCh)

	sigterm := make(chan os.Signal, 1)
	signal.Notify(sigterm, syscall.SIGTERM)
	signal.Notify(sigterm, syscall.SIGINT)
	<-sigterm

	return nil

}
