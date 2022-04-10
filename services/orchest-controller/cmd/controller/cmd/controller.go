package cmd

import (
	"path"

	"github.com/orchest/orchest/services/orchest-controller/pkg/deployers"
	"github.com/orchest/orchest/services/orchest-controller/pkg/manager"
	"github.com/spf13/cobra"
	"k8s.io/klog/v2"
)

var (
	deployDir string
	inCluster bool
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

	cmd.PersistentFlags().StringVar(&deployDir, "deployDir", "/deploy", "The directory which holds the deployment folders")
	cmd.PersistentFlags().BoolVar(&inCluster, "inCluster", true, "In/Out cluster indicator")

	return cmd
}

func runControllerCmd() error {
	klog.Info("running orchest controller")

	addons := initDeployers()

	mg := manager.NewManager(inCluster, addons)
	err := mg.Run()
	if mg != nil {
		klog.Error(err)
	}

	return err
}

func initDeployers() *deployers.DeployerManager {
	deployers := deployers.NewDeployerManager(deployDir)

	deployers.AddDeployer(deployers.NewHelmDeployer("argo", path.Join(deployDir, "thirdparty/argo-workflows")))
	deployers.AddDeployer(deployers.NewHelmDeployer("registry", path.Join(deployDir, "thirdparty/argo-workflows")))
	deployers.AddDeployer(deployers.NewHelmDeployer("orchest-rsc", path.Join(deployDir, "charts")))
	deployers.AddDeployer(deployers.NewHelmDeployer("orchest", path.Join(deployDir, "charts")))

	return deployers
}
