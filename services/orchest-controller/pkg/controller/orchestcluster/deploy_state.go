package orchestcluster

import (
	"context"
	"fmt"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/controller"
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

	generation := fmt.Sprint(orchest.Generation)

	// First we make sure resources are created
	// {controller.Resources},
	creatingEvent := utils.GetCreatingEvent(controller.Resources)
	if ok := stateMachine.containsCondition(creatingEvent); !ok {
		err := stateMachine.Create(ctx, controller.Resources, creatingEvent, deployTimeOut, deployRetry, orchest)
		if err != nil {
			return err
		}
	}
	// if resources are not created yet, we move on
	if !stateMachine.containsCondition(utils.GetCreatedEvent(controller.Resources)) {
		return nil
	}

	for i, stage = range creationStages {

		deployedApps := 0
		for _, componentName := range stage {
			creatingEvent := utils.GetCreatingEvent(componentName)

			if ok := stateMachine.containsCondition(creatingEvent); !ok {
				template, err := GetComponentTemplate(componentName, orchest)
				if err != nil {
					return err
				}

				component := getOrchestComponent(componentName, generation, template, orchest)

				err = stateMachine.Create(ctx, componentName, creatingEvent, deployTimeOut, deployRetry, component)
				if err != nil {
					return err
				}
			}

			if stateMachine.containsCondition(utils.GetCreatedEvent(componentName)) {
				deployedApps++
			}
		}

		// All components of this stage are not deployed yet, so we can not move to the next stage,
		if deployedApps != len(stage) {
			return nil
		}
	}

	if i == len(creationStages)-1 {
		stateMachine.toState(ctx, orchestv1alpha1.Running)
	}
	return nil
}
