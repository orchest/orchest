package orchestcluster

import (
	"context"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
)

type DeployOrchestState struct{}

func NewDeployOrchestState() StateHandler {
	return &DeployOrchestState{}
}

func (state *DeployOrchestState) To(ctx context.Context, stateMachine *OrchestStateMachine) {

}

func (state *DeployOrchestState) Do(ctx context.Context, stateMachine *OrchestStateMachine, orchest *orchestv1alpha1.OrchestCluster) error {

	var i int
	var stage []string
	for i, stage = range deploymentStages {

		deployedApps := 0
		for _, component := range stage {
			deployingEvent := utils.GetDeployingEvent(component)

			if ok := stateMachine.containsCondition(deployingEvent); !ok {
				template, err := GetComponentTemplate(component, orchest)
				if err != nil {
					return err
				}
				err = stateMachine.Deploy(ctx, component, deployingEvent, deployTimeOut, deployRetry, template)
				if err != nil {
					return err
				}
			}

			if stateMachine.containsCondition(utils.GetDeployedEvent(component)) {
				deployedApps++
			}
		}

		// All components of this stage are not deployed yet, so we can not move to the next stage,
		if deployedApps != len(stage) {
			return nil
		}
	}

	if i == len(deploymentStages)-1 {
		stateMachine.toState(ctx, orchestv1alpha1.Running)
	}
	return nil
}
