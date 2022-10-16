package orchestcluster

import (
	"context"
	"fmt"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/controller"
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

	if orchest.Spec.Orchest.Pause != nil &&
		*orchest.Spec.Orchest.Pause {
		return stateMachine.toState(ctx, orchestv1alpha1.Stopping)
	} else if _, ok := orchest.GetAnnotations()[controller.RestartAnnotationKey]; ok {
		return stateMachine.toState(ctx, orchestv1alpha1.Stopping)
	}

	generation := fmt.Sprint(orchest.Generation)

	// First we make sure resources are created
	if !stateMachine.expectCreation(controller.Resources) {
		err := stateMachine.Create(ctx, controller.Resources, deployTimeOut, deployRetry, orchest)
		return err
	}

	if !stateMachine.isCreated(controller.Resources) {
		return nil
	}

	for i, stage = range creationStages {

		createdApps := 0
		for _, componentName := range stage {

			if stateMachine.isCreated(componentName) {
				createdApps++
			} else if !stateMachine.expectCreation(componentName) {
				template, err := GetComponentTemplate(componentName, orchest)
				if err != nil {
					return err
				}

				component := getOrchestComponent(componentName, generation, template, orchest)

				err = stateMachine.Create(ctx, componentName, deployTimeOut, deployRetry, component)
				if err != nil {
					return err
				}
			}

		}

		// All components of this stage are not created yet, so we can not move to the next stage,
		if createdApps != len(stage) {
			return nil
		}
	}

	if i == len(creationStages)-1 {
		stateMachine.toState(ctx, orchestv1alpha1.Running)
	}
	return nil
}
