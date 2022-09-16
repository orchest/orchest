package orchestcluster

import (
	"context"

	"github.com/orchest/orchest/services/orchest-controller/pkg/addons"
	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
)

type DeployThirdPartyState struct{}

func NewDeployThirdPartyState() StateHandler {
	return &DeployThirdPartyState{}
}

func (state *DeployThirdPartyState) To(ctx context.Context, stateMachine *OrchestStateMachine) {
	// Set number of retries and timeout
}

func (state *DeployThirdPartyState) Do(ctx context.Context, stateMachine *OrchestStateMachine, orchest *orchestv1alpha1.OrchestCluster) error {

	deployedApps := 0
	for _, application := range orchest.Spec.Applications {

		if ok := stateMachine.containsCondition(addons.LogEvent(utils.GetDeployingEvent(application.Name))); !ok {
			err := stateMachine.Deploy(ctx, application.Name, &application)
			if err != nil {
				return err
			}
		} else if stateMachine.containsCondition(addons.LogEvent(utils.GetDeployedEvent(application.Name))) {
			deployedApps++
		}
	}

	if deployedApps == len(orchest.Spec.Applications) {
		stateMachine.toState(ctx, orchestv1alpha1.DeployingOrchest)
	}
	return nil
}
