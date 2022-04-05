package orchestcluster

import (
	"context"

	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
)

// NewOrchestClusterReconciler returns a new *OrchestClusterReconciler.
func NewOrchestClusterReconciler() *OrchestClusterReconciler {

	reconciler := OrchestClusterReconciler{}

	return &reconciler
}

// OrchestClusterReconciler reconciles OrchestCluster CRD.
type OrchestClusterReconciler struct {
}

func (r *OrchestClusterReconciler) Reconcile(context context.Context, req ctrl.Request) (_ ctrl.Result, reterr error) {
	return reconcile.Result{}, nil
}
