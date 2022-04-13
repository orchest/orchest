package deployer

import (
	"context"

	"k8s.io/klog/v2"
)

type Deployer interface {

	//returns the name of the addon
	GetName() string

	// Installs addons if the config is changed
	InstallIfChanged(ctx context.Context, namespace string, config interface{}) error

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
func (m *DeployerManager) AddDeployer(deployer Deployer) {

	// If already registred, log warning and return
	if _, ok := m.deployers[deployer.GetName()]; ok {
		klog.Warning("deployer %s is already registred with deployer manager", deployer.GetName())
	}

	m.deployers[deployer.GetName()] = deployer
	klog.V(2).Info("Deployer is registred with deployer manager")
}

// get a deployer by the name
func (m *DeployerManager) Get(name string) Deployer {
	return m.deployers[name]
}
