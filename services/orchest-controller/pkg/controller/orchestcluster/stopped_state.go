package orchestcluster

import (
	"context"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/controller"
)

type StoppedOrchestState struct{}

func NewStoppedOrchestState() StateHandler {
	return &StoppedOrchestState{}
}

func (state *StoppedOrchestState) To(ctx context.Context, stateMachine *OrchestStateMachine) {
	// The cluster is deleted, the StateMachine should exit
	if stateMachine.isOrchestDeleted() {
		stateMachine.exit(ctx)
	}
}

func (state *StoppedOrchestState) Do(ctx context.Context, stateMachine *OrchestStateMachine, orchest *orchestv1alpha1.OrchestCluster) error {

	// The cluster is deleted, the StateMachine should exit
	if stateMachine.isOrchestDeleted() {
		return stateMachine.exit(ctx)
	}

	// The cluster is paused, remove the restart annotation if present
	_, err := controller.RemoveAnnotation(ctx, stateMachine.controller.gClient, orchest, controller.RestartAnnotationKey)
	if err != nil {
		return err
	}

	// if cluster is not paused, we should go to deploying state
	if orchest.Spec.Orchest.Pause != nil && !*orchest.Spec.Orchest.Pause {
		err = stateMachine.toState(ctx, orchestv1alpha1.DeployingOrchest)
	}

	return err
}
