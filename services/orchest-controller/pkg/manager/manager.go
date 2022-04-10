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

// Manager encapsulates creating kubernetes controller manager.
type Manager struct {
	scheme    *runtime.Scheme
	config    *rest.Config
	mgr       ctrl.Manager
	deployDir string
}

// NewManager returns *NewManager.
func NewManager(inCluster bool, deployDir string) (*Manager, error) {

	scheme := runtime.NewScheme()
	orchestv1alpha1.AddToScheme(scheme)

	clientgoscheme.AddToScheme(scheme)

	config := utils.GetClientConfig(inCluster)

	mgr, err := ctrl.NewManager(
		config, ctrl.Options{
			Scheme: scheme,
		})

	if err != nil {
		return nil, err
	}

	return &Manager{
		scheme:    scheme,
		config:    config,
		deployDir: deployDir,
		mgr:       mgr,
	}, nil

}

// Run the operator instance.
func (m *Manager) Run() error {

	reconciler := orchestcluster.NewOrchestClusterReconciler(m.mgr, m.deployDir)

	if err := ctrl.NewControllerManagedBy(m.mgr).
		For(&orchestv1alpha1.OrchestCluster{}).
		Complete(reconciler); err != nil {
		return err
	}

	klog.Info("starting orchest manager")
	return m.mgr.Start(ctrl.SetupSignalHandler())

}
