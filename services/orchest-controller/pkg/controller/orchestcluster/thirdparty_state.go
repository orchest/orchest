package orchestcluster

import (
	"context"
	"time"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
)

var (
	deployTimeOut time.Duration = time.Second * 5
	deployRetry                 = 5
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

		deployingEvent := utils.GetDeployingEvent(application.Name)
		if ok := stateMachine.containsCondition(deployingEvent); !ok {
			err := stateMachine.Deploy(ctx, application.Name, deployingEvent, deployTimeOut, deployRetry, &application)
			if err != nil {
				return err
			}
		}

		if stateMachine.containsCondition(utils.GetDeployedEvent(application.Name)) {
			deployedApps++
		}
	}

	if deployedApps == len(orchest.Spec.Applications) {
		stateMachine.toState(ctx, orchestv1alpha1.DeployingOrchest)
	}
	return nil
}
