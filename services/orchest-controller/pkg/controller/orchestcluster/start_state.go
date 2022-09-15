package orchestcluster

import (
	"context"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
)

type StartOrchestState struct{}

func NewStartOrchestState() StateHandler {
	return &StartOrchestState{}
}

func (state *StartOrchestState) To(ctx context.Context, stateMachine *OrchestStateMachine) {

}

func (state *StartOrchestState) Do(ctx context.Context, stateMachine *OrchestStateMachine, orchest *orchestv1alpha1.OrchestCluster) error {
	return nil
}
