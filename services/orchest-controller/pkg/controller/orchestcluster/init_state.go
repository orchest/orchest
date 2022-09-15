package orchestcluster

import (
	"context"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
)

type InitState struct{}

func NewInitState() StateHandler {
	return &InitState{}
}

func (state *InitState) To(ctx context.Context, stateMachine *OrchestStateMachine) {
	// TODO: Set timeout for the state
}

func (state *InitState) Do(ctx context.Context, stateMachine *OrchestStateMachine, orchest *orchestv1alpha1.OrchestCluster) error {
	return stateMachine.toState(ctx, orchestv1alpha1.DeployingThirdParties)
}
