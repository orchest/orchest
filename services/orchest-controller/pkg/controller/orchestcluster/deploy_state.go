package orchestcluster

import (
	"context"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
)

type DeployOrchestState struct{}

func NewDeployOrchestState() StateHandler {
	return &DeployOrchestState{}
}

func (state *DeployOrchestState) To(ctx context.Context, stateMachine *OrchestStateMachine) {

}

func (state *DeployOrchestState) Do(ctx context.Context, stateMachine *OrchestStateMachine, orchest *orchestv1alpha1.OrchestCluster) error {
	return nil
}
