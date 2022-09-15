package orchestcluster

import (
	"context"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
)

type UpdateOrchestState struct{}

func NewUpdateOrchestState() StateHandler {
	return &UpdateOrchestState{}
}

func (state *UpdateOrchestState) To(ctx context.Context, stateMachine *OrchestStateMachine) {

}

func (state *UpdateOrchestState) Do(ctx context.Context, stateMachine *OrchestStateMachine, orchest *orchestv1alpha1.OrchestCluster) error {
	return nil
}
