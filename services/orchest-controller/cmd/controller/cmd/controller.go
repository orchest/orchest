package cmd

import (
	"os"
	"os/signal"
	"syscall"

	"github.com/orchest/orchest/services/orchest-controller/pkg/controller/orchestcluster"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	"github.com/spf13/cobra"
	"k8s.io/klog/v2"
)

var (
	controllerConfig orchestcluster.ControllerConfig
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

	cmd.PersistentFlags().StringVar(&controllerConfig.DeployDir, "deployDir", "/deploy", "The directory which holds the deployment folders")
	cmd.PersistentFlags().StringVar(&controllerConfig.PostgresDefaultImage, "postgresImage", "postgres:13.1", "The default postgres image if not provided in CR")
	cmd.PersistentFlags().StringVar(&controllerConfig.RabbitmqDefaultImage, "rabbitmqImage", "rabbitmq:3", "The default rabbitmq image if not provided in CR")
	cmd.PersistentFlags().StringVar(&controllerConfig.UserdirDefaultVolumeSize, "userdirSize", "999Ti", "The default size for userdir pvc")
	cmd.PersistentFlags().StringVar(&controllerConfig.ConfigdirDefaultVolumeSize, "configSize", "10Mi", "The default size for configdir pvc")
	cmd.PersistentFlags().StringVar(&controllerConfig.BuilddirDefaultVolumeSize, "builderSize", "999Ti", "The default size for builddir pvc")
	cmd.PersistentFlags().StringVar(&controllerConfig.OrchestDefaultVersion, "defaultVersion", "v2022.04.0", "The default version for orchest components")
	cmd.PersistentFlags().BoolVar(&controllerConfig.DefaultPause, "pause", false, "Default Orchest Cluster pause state")
	cmd.PersistentFlags().StringVar(&controllerConfig.CeleryWorkerImageName, "celeryImageName", "orchest/celery-worker", "The default celery-worker image name")
	cmd.PersistentFlags().StringVar(&controllerConfig.OrchestApiImageName, "orchestApiImageName", "orchest/orchest-api", "The default orchest-api image name")
	cmd.PersistentFlags().StringVar(&controllerConfig.OrchestWebserverImageName, "webserverImageName", "orchest/orchest-webserver", "The default orchest-webserver image name")
	cmd.PersistentFlags().StringVar(&controllerConfig.AuthServerImageName, "authServerImageName", "orchest/auth-server", "The default auth server image name")
	cmd.PersistentFlags().IntVar(&controllerConfig.Threadiness, "threadiness", 1, "threadiness of the controller")
	cmd.PersistentFlags().BoolVar(&controllerConfig.InCluster, "inCluster", true, "In/Out cluster indicator")

	return cmd
}

func runControllerCmd() error {
	klog.Info("running orchest controller")

	stopCh := make(chan struct{})
	defer close(stopCh)

	// Initialize scheme
	scheme := utils.GetScheme()

	// Initialize clients
	kClient, oClient, gClient := utils.GetClientsOrDie(controllerConfig.InCluster, scheme)

	depInformer := utils.NewDeploymentInformer(kClient)
	ocInformer := utils.NewOrchestClusterInformer(oClient)
	orchestController := orchestcluster.NewOrchestClusterController(kClient,
		oClient,
		gClient,
		scheme,
		controllerConfig,
		ocInformer,
		depInformer)

	go orchestController.Run(stopCh)
	go ocInformer.Informer().Run(stopCh)
	go depInformer.Informer().Run(stopCh)

	sigterm := make(chan os.Signal, 1)
	signal.Notify(sigterm, syscall.SIGTERM)
	signal.Notify(sigterm, syscall.SIGINT)
	<-sigterm

	return nil

}
