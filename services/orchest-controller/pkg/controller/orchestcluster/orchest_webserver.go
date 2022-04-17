package orchestcluster

import (
	"context"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	appsv1 "k8s.io/api/apps/v1"
)

func (r *OrchestReconciler) pauseOrchestWebserver(ctx context.Context,
	orchest *orchestv1alpha1.OrchestCluser,
	webserver *appsv1.Deployment) error {

}
