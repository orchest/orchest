package orchestcluster

import (
	"context"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
)

type ErrorState struct{}

func NewErrorState() StateHandler {
	return &UpdateOrchestState{}
}

func (state *ErrorState) To(ctx context.Context, stateMachine *OrchestStateMachine) {

}

func (state *ErrorState) Do(ctx context.Context, stateMachine *OrchestStateMachine, orchest *orchestv1alpha1.OrchestCluster) error {
	return nil
}
