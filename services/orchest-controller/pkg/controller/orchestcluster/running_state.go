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
	return nil
}
