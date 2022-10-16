package orchestcluster

import (
	"context"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
)

type RunningState struct{}

func NewRunningState() StateHandler {
	return &RunningState{}
}

func (state *RunningState) To(ctx context.Context, stateMachine *OrchestStateMachine) {

}

func (state *RunningState) Do(ctx context.Context, stateMachine *OrchestStateMachine, orchest *orchestv1alpha1.OrchestCluster) error {

	if !orchest.GetDeletionTimestamp().IsZero() && orchest.Status.Phase != orchestv1alpha1.Stopped {
		// The cluster is deleted.
		return stateMachine.toState(ctx, orchestv1alpha1.Stopping)
	}

	if orchest.Status.ObservedGeneration != orchest.Generation {
		// If the ObservedGeneration is different that the actual Generation we go to stopping state.
		return stateMachine.toState(ctx, orchestv1alpha1.Stopping)
	}
	return nil
}
