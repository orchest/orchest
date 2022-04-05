package controller

import (
	"github.com/orchest/orchest/services/orchest-controller/pkg/manager"
	"github.com/spf13/cobra"
	"k8s.io/klog/v2"
)

var (
	namespace string
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

	cmd.PersistentFlags().StringVar(&namespace, "namespace", "", "The namespace of this controller")
	cmd.PersistentFlags().BoolVar(&inCluster, "inCluster", true, "In/Out cluster indicator")

	return cmd
}

func runControllerCmd() error {
	klog.Info("running orchest controller")

	mg := manager.NewManager(inCluster)
	err := mg.Run()
	if mg != nil {
		klog.Error(err)
	}

	return err
}
