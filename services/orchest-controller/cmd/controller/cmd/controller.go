package cmd

import (
	"github.com/orchest/orchest/services/orchest-controller/pkg/manager"
	"github.com/orchest/orchest/services/orchest-controller/pkg/reconciler/orchestcluster"
	"github.com/spf13/cobra"
	"k8s.io/klog/v2"
)

var (
	managerConfig    manager.ManagerConfig
	reconcilerConfig orchestcluster.ReconcilerConfig
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

	cmd.PersistentFlags().StringVar(&reconcilerConfig.DeployDir, "deployDir", "/deploy", "The directory which holds the deployment folders")
	cmd.PersistentFlags().StringVar(&reconcilerConfig.PostgresDefaultImage, "postgresImage", "postgres:13.1", "The default postgres image if not provided in CR")
	cmd.PersistentFlags().StringVar(&reconcilerConfig.RabbitmqDefaultImage, "rabbitmqImage", "rabbitmq:3", "The default rabbitmq image if not provided in CR")
	cmd.PersistentFlags().StringVar(&reconcilerConfig.UserdirDefaultVolumeSize, "userdirSize", "999Ti", "The default size for userdir pvc")
	cmd.PersistentFlags().StringVar(&reconcilerConfig.ConfigdirDefaultVolumeSize, "configSize", "10Mi", "The default size for configdir pvc")
	cmd.PersistentFlags().StringVar(&reconcilerConfig.BuilddirDefaultVolumeSize, "builderSize", "999Ti", "The default size for builddir pvc")
	cmd.PersistentFlags().StringVar(&reconcilerConfig.OrchestDefaultTag, "defaultTag", "v2022.04.0", "The default tag for orchest components")
	cmd.PersistentFlags().StringVar(&reconcilerConfig.CeleryWorkerImageName, "celeryImageName", "orchest/celery-worker", "The default celery-worker image name")
	cmd.PersistentFlags().StringVar(&reconcilerConfig.OrchestApiImageName, "orchestApiImageName", "orchest/orchest-api", "The default orchest-api image name")
	cmd.PersistentFlags().StringVar(&reconcilerConfig.OrchestWebserverImageName, "webserverImageName", "orchest/orchest-webserver", "The default orchest-webserver image name")
	cmd.PersistentFlags().StringVar(&reconcilerConfig.AuthServerImageName, "authServerImageName", "999Ti", "The default auth server image name")
	cmd.PersistentFlags().BoolVar(&managerConfig.InCluster, "inCluster", true, "In/Out cluster indicator")

	return cmd
}

func runControllerCmd() error {
	klog.Info("running orchest controller")

	mg, err := manager.NewManager(&managerConfig, &reconcilerConfig)
	if err != nil {
		klog.Fatal(err)
	}

	err = mg.Run()

	return err
}
