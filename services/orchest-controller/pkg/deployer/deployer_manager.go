package deployer

import (
	"context"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"k8s.io/klog/v2"
)

type Deployer interface {
	// Installs addons if the config is changed
	InstallIfChanged(ctx context.Context, namespace string, orchest *orchestv1alpha1.OrchestCluster) error

	// Uninstall the addon
	Uninstall(ctx context.Context, namespace string) error
}

// Deployer manager holds the map of deployers
type DeployerManager struct {
	deployers map[string]Deployer
}

func NewDeployerManager() *DeployerManager {

	deployerManager := DeployerManager{
		deployers: make(map[string]Deployer),
	}

	return &deployerManager
}

// add a deployer, if not already registred with the manager
func (m *DeployerManager) AddDeployer(name string, deployer Deployer) {

	// If already registred, log warning and return
	if _, ok := m.deployers[name]; ok {
		klog.Warningf("deployer %s is already registred with deployer manager", name)
	}

	m.deployers[name] = deployer
	klog.V(2).Info("Deployer is registred with deployer manager")
}

// get a deployer by the name
func (m *DeployerManager) Get(name string) Deployer {
	return m.deployers[name]
}
