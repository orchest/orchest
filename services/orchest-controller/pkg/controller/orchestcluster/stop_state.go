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

	// at last
	if !orchest.GetDeletionTimestamp().IsZero() {
		stateMachine.exit(ctx)
	}

	return nil
}
