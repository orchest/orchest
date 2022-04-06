package v1alpha1

import (
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const (
	Finalizer = "controller.orchest.io"
)

const (
	EventCreated = "Created"
	EventUpdated = "Updated"
	EventFailed  = "Failed"
)

type OrchestState string

const (
	StateInitializing OrchestState = "Initializing"
	StateRestarting   OrchestState = "Restarting"
	StateStarting     OrchestState = "Starting"
	StateStopping     OrchestState = "Stopping"
	StateStopped      OrchestState = "Stopped"
	StateUnhealthy    OrchestState = "Unhealthy"
	StatePending      OrchestState = "Pending"
	StateUninstalling OrchestState = "Uninstalling"
	StateRunning      OrchestState = "Running"
	StateUpdating     OrchestState = "Updating"
	StateError        OrchestState = "Error"
)

// OrchestSpec describes the attributes of orchest components.
type OrchestSpec struct {
	Registry   string `json:"registry,omitempty"`
	DefaultTag string `json:"defaultTag,omitempty"`

	// If specified, orchest-api for this cluster will be deployed with this configuration
	OrchestApi v1.Container `json:"orchestApi,omitempty"`

	// If specified, orchest-webserver for this cluster will be deployed with this configuration
	OrchestWebServer v1.Container `json:"orchestWebServer,omitempty"`

	// If specified, celery-worker for this cluster will be deployed with this configuration
	CeleryWorker v1.Container `json:"celeryWorker,omitempty"`
}

// RegistrySpec describes the attributes of docker-registry which will be used by step containers.
type RegistrySpec struct {
	VolumeSize string `json:"volumeSize,omitempty"`
}

// OrchestClusterSpec describes the attributes that a user creates on a OrchestCluster.
type OrchestClusterSpec struct {
	// Wether Orchest is Single Node or not, if specified, all pods of the orchest
	// including session pods will be scheduled on the same node.
	SingleNode bool `json:"singleNode,omitempty"`

	Orchest OrchestSpec `json:"orchest,omitempty"`
}

// OrchestClusterStatus defines the status of OrchestCluster
type OrchestClusterStatus struct {
	State   OrchestState `json:"state,omitempty"`
	Message string       `json:"message,omitempty"`
	Reason  string       `json:"reason,omitempty"`
}

// +genclient
// +genclient:noStatus
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

// OrchestCluster is the Schema for the Orchest deployment
type OrchestCluster struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   OrchestClusterSpec   `json:"spec,omitempty"`
	Status OrchestClusterStatus `json:"status,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
// +kubebuilder:object:root=true

// OrchestClusterList contains a list of OrchestCluster
type OrchestClusterList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata"`
	Items           []*OrchestCluster `json:"items"`
}
