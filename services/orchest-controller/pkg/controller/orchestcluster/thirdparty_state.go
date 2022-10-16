package orchestcluster

import (
	"context"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
)

type DeployThirdPartyState struct{}

func NewDeployThirdPartyState() StateHandler {
	return &DeployThirdPartyState{}
}

func (state *DeployThirdPartyState) To(ctx context.Context, stateMachine *OrchestStateMachine) {
	// Set number of retries and timeout
}

func (state *DeployThirdPartyState) Do(ctx context.Context, stateMachine *OrchestStateMachine, orchest *orchestv1alpha1.OrchestCluster) error {

	createdApps := 0
	for _, application := range orchest.Spec.Applications {

		if stateMachine.isCreated(application.Name) {
			createdApps++
		} else if ok := stateMachine.expectCreation(application.Name); !ok {
			err := stateMachine.Create(ctx, application.Name, deployTimeOut, deployRetry, &application)
			if err != nil {
				return err
			}
		}

	}

	if createdApps == len(orchest.Spec.Applications) {
		stateMachine.toState(ctx, orchestv1alpha1.DeployingOrchest)
	}
	return nil
}
