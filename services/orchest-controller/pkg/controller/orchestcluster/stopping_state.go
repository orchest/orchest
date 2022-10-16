package orchestcluster

import (
	"context"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
)

type StopOrchestState struct{}

func NewStopOrchestState() StateHandler {
	return &StopOrchestState{}
}

func (state *StopOrchestState) To(ctx context.Context, stateMachine *OrchestStateMachine) {

}

func (state *StopOrchestState) Do(ctx context.Context, stateMachine *OrchestStateMachine, orchest *orchestv1alpha1.OrchestCluster) error {

	var i int
	for i = len(creationStages) - 1; i >= 0; i-- {

		deletedApps := 0
		for _, componentName := range creationStages[i] {

			if stateMachine.isDeleted(componentName) {
				deletedApps++
			} else if !stateMachine.expectDeletion(componentName) {
				template, err := GetComponentTemplate(componentName, orchest)
				if err != nil {
					return err
				}

				component := getOrchestComponent(componentName, "", template, orchest)
				err = stateMachine.Delete(ctx, componentName, deployRetry, component)
				if err != nil {
					return err
				}
			}
		}

		// All components of this stage are not deleted yet, so we can not move to delete the previous step,
		if deletedApps != len(creationStages[i]) {
			return nil
		}
	}

	if i == -1 {
		stateMachine.toState(ctx, orchestv1alpha1.Stopped)
	}

	return nil

}
