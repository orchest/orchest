package manager

import (
	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/reconciler/orchestcluster"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	"k8s.io/apimachinery/pkg/runtime"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/klog/v2"
	ctrl "sigs.k8s.io/controller-runtime"
)

type ManagerConfig struct {
	InCluster bool
}

// Manager encapsulates creating kubernetes controller manager.
type Manager struct {
	mgr              ctrl.Manager
	scheme           *runtime.Scheme
	k8sconfig        *rest.Config
	reconcilerConfig *orchestcluster.ReconcilerConfig
}

// NewManager returns *NewManager.
func NewManager(mgrConfig *ManagerConfig,
	reconcilerConfig *orchestcluster.ReconcilerConfig) (*Manager, error) {

	scheme := runtime.NewScheme()
	orchestv1alpha1.AddToScheme(scheme)

	clientgoscheme.AddToScheme(scheme)

	k8sconfig := utils.GetClientConfig(mgrConfig.InCluster)

	mgr, err := ctrl.NewManager(
		k8sconfig, ctrl.Options{
			Scheme: scheme,
		})

	if err != nil {
		return nil, err
	}

	return &Manager{
		scheme:           scheme,
		k8sconfig:        k8sconfig,
		reconcilerConfig: reconcilerConfig,
		mgr:              mgr,
	}, nil

}

// Run the operator instance.
func (m *Manager) Run() error {

	reconciler := orchestcluster.NewOrchestClusterReconciler(m.mgr, m.reconcilerConfig)

	if err := ctrl.NewControllerManagedBy(m.mgr).
		For(&orchestv1alpha1.OrchestCluster{}).
		Complete(reconciler); err != nil {
		return err
	}

	klog.Info("starting orchest manager")
	return m.mgr.Start(ctrl.SetupSignalHandler())

}
