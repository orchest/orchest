package addons

import (
	"context"

	"k8s.io/klog/v2"
)

type Addon interface {

	//returns the name of the addon
	GetName() string

	// Installs addons if the config is changed
	InstallIfChanged(ctx context.Context, namespace string, config interface{}) error

	// Uninstall the addon
	Uninstall(ctx context.Context, namespace string) error
}

// Addon manager holds the map of addons
type AddonManager struct {
	addons map[string]Addon
}

func NewAddonManager(baseDeployDir string) *AddonManager {

	addons := AddonManager{
		addons: make(map[string]Addon),
	}

	return &addons
}

// add an addon, if not already registred with the manager
func (m *AddonManager) AddAddon(addon Addon) {

	// If already registred, log warning and return
	if _, ok := m.addons[addon.GetName()]; ok {
		klog.Warning("Addon %s is already registred with addon msnsger", addon.GetName())
	}

	m.addons[addon.GetName()] = addon
	klog.V(2).Info("Addon is registred with addon manager")
}
