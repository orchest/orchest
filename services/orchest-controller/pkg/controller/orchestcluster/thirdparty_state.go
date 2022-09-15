package orchestcluster

import (
	"context"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/controller"
)

type DeployThirdPartyState struct{}

func NewDeployThirdPartyState() StateHandler {
	return &DeployThirdPartyState{}
}

func (state *DeployThirdPartyState) To(ctx context.Context, stateMachine *OrchestStateMachine) {
	// Set number of retries and timeout
}

func (state *DeployThirdPartyState) Do(ctx context.Context, stateMachine *OrchestStateMachine, orchest *orchestv1alpha1.OrchestCluster) error {

	for _, application := range orchest.Spec.Applications {

		if ok := stateMachine.containsCondition(controller.GetDeployingEvent(application.Name)); !ok {
			stateMachine.Deploy(ctx, application.Name, &application)
		}

		/*
			err = occ.addonManager.Get(application.Name).Enable(ctx, preInstallHooks, orchest.Namespace, &application)
			if err != nil {
				klog.Error(err)
				return err
			}
		*/

	}
	return nil
}
