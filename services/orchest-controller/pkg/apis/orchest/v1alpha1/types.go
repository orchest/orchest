package v1alpha1

import (
	corev1 "k8s.io/api/core/v1"
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

// OrchestPhase is a label for the condition of a OrchestCluster at the current time.
type OrchestPhase string

//type OrchestClusterEvent string

const (
	// OrchestClusterPhase
	// Altering the string of Running, Restarting, Updating might lead
	// to breaking some cloud health checks.
	Initializing          OrchestPhase = "Initializing"
	DeployingThirdParties OrchestPhase = "Deploying Third Parties"
	DeployedThirdParties  OrchestPhase = "Deployed Third Parties"
	DeployingOrchest      OrchestPhase = "Deploying Orchest Control Plane"
	DeployedOrchest       OrchestPhase = "Deployed Orchest Control Plane"
	Restarting            OrchestPhase = "Restarting"
	Starting              OrchestPhase = "Starting"
	Running               OrchestPhase = "Running"
	Stopping              OrchestPhase = "Stopping"
	Cleanup               OrchestPhase = "Cleanup"
	Stopped               OrchestPhase = "Stopped"
	Updating              OrchestPhase = "Updating"
	Error                 OrchestPhase = "Error"
	Unknown               OrchestPhase = "Unknown"
	Unhealthy             OrchestPhase = "Unhealthy"
	Deleting              OrchestPhase = "Deleting"

	/*
		//Events
		// DeployingThirdParties events
		DeployingArgo         OrchestClusterEvent = "Deploying argo-workflow"
		DeployingCertManager  OrchestClusterEvent = "Deploying cert-manager"
		DeployingRegistry     OrchestClusterEvent = "Deploying docker-registry"
		CreatingCertificates  OrchestClusterEvent = "Creating docker-registry certificates"
		DeployingNginxIngress OrchestClusterEvent = "Deploying nginx-ingress"

		// DeployingOrchest and Upgrading events
		DeployingOrchestDatabase OrchestClusterEvent = "Deploying orchest-database"
		UpgradingOrchestDatabase OrchestClusterEvent = "Upgrading orchest-database"

		DeployingAuthServer OrchestClusterEvent = "Deploying auth-server"
		UpgradingAuthServer OrchestClusterEvent = "Upgrading auth-server"

		DeployingCeleryWorker OrchestClusterEvent = "Deploying celery-worker"
		UpgradingCeleryWorker OrchestClusterEvent = "Upgrading celery-worker"

		DeployingOrchestApi OrchestClusterEvent = "Deploying orchest-api"
		UpgradingOrchestApi OrchestClusterEvent = "Upgrading orchest-api"

		DeployingOrchestWebserver OrchestClusterEvent = "Deploying orchest-webserver"
		UpgradingOrchestWebserver OrchestClusterEvent = "Upgrading orchest-webserver"

		DeployingRabbitmq OrchestClusterEvent = "Deploying rabbitmq-server"
		UpgradingRabbitmq OrchestClusterEvent = "Upgrading rabbitmq-server"

		DeployingNodeAgent OrchestClusterEvent = "Deploying node-agent"
		UpgradingNodeAgent OrchestClusterEvent = "Upgrading node-agent"
	*/
)

type OrchestResourcesSpec struct {
	// If specified, this components will be deployed provided image
	UserDirVolumeSize string `json:"userDirVolumeSize,omitempty"`

	// The Storage class of user-dir/
	StorageClassName string `json:"storageClassName,omitempty"`

	// Deprecated and ignored. TODO: remove it?
	ConfigDirVolumeSize string `json:"configDirVolumeSize,omitempty"`
}

type OrchestComponentTemplate struct {
	//If specified, this components will be deployed provided image
	Image string `json:"image,omitempty"`

	// List of environment variables to set in the container.
	Env []corev1.EnvVar `json:"env,omitempty"`

	// NodeSelector is a selector which must be true for the pod to fit on a node.
	// Selector which must match a node's labels for the pod to be scheduled on that node.
	// More info: https://kubernetes.io/docs/concepts/configuration/assign-pod-node/
	NodeSelector map[string]string `json:"nodeSelector,omitempty"`
}

type OrchestComponentStatus struct {
	// The generation observed by the controller.
	ObservedGeneration int64 `json:"observedGeneration,omitempty" protobuf:"varint,1,opt,name=observedGeneration"`

	// The observed hash of the spec by the controller.
	ObservedHash string `json:"observedHash,omitempty" protobuf:"varint,1,opt,name=observedGeneration"`

	Phase OrchestPhase `json:"state,omitempty"`

	Version string `json:"version,omitempty"`

	LastHeartbeatTime metav1.Time `json:"lastHeartbeatTime,omitempty"`
}

type OrchestComponentSpec struct {
	ReconcilerName string `json:"reconcilerName,omitempty"`

	OrchestHost *string `json:"orchestHost,omitempty"`

	Template OrchestComponentTemplate `json:"template,omitempty"`
}

// +genclient
// +kubebuilder:subresource:status
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

// OrchestComponent is the Schema for the Orchest component deployment
type OrchestComponent struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   OrchestComponentSpec    `json:"spec,omitempty"`
	Status *OrchestComponentStatus `json:"status,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
// +kubebuilder:object:root=true

// OrchestComponentList contains a list of OrchestComponent
type OrchestComponentList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata"`
	Items           []*OrchestComponent `json:"items"`
}

// OrchestSpec describes the attributes of orchest components.
type OrchestSpec struct {

	// Indicate if the cluster is in Pause state or not
	Pause *bool `json:"pause,omitempty"`

	OrchestHost *string `json:"orchestHost,omitempty"`

	Registry string `json:"registry,omitempty"`

	Version string `json:"version,omitempty"`

	Env []corev1.EnvVar `json:"env,omitempty"`

	// orchest resources spec, such as user-dir volume size and storage class
	Resources OrchestResourcesSpec `json:"resources,omitempty"`

	// If specified, orchest-api for this cluster will be deployed with this configuration
	OrchestApi OrchestComponentTemplate `json:"orchestApi,omitempty"`

	// If specified, orchest-webserver for this cluster will be deployed with this configuration
	OrchestWebServer OrchestComponentTemplate `json:"orchestWebServer,omitempty"`

	// If specified, celery-worker for this cluster will be deployed with this configuration
	CeleryWorker OrchestComponentTemplate `json:"celeryWorker,omitempty"`

	// If specified, node-agent for this cluster will be deployed with this configuration
	NodeAgent OrchestComponentTemplate `json:"nodeAgent,omitempty"`

	// If specified, buildkit-daemon for this cluster will be deployed with this configuration
	BuildKitDaemon OrchestComponentTemplate `json:"buildkitDaemon,omitempty"`

	// If specified, auth-server for this cluster will be deployed with this configuration
	AuthServer OrchestComponentTemplate `json:"authServer,omitempty"`
}

// Partially borrowed from argocd
// ApplicationConfig contains all required information about the source of an application
type ApplicationConfig struct {
	// Helm holds helm specific options
	Helm *ApplicationConfigHelm `json:"helm,omitempty"`
}

// ApplicationConfigHelm holds helm specific options
type ApplicationConfigHelm struct {
	// Values is a list of Helm values to use when generating a template
	Values []string `json:"values,omitempty"`
	// Parameters is a list of Helm parameters which are passed to the helm template command upon manifest generation
	Parameters []HelmParameter `json:"parameters,omitempty"`
	// ReleaseName is the Helm release name to use. If omitted it will use the application name
	ReleaseName string `json:"releaseName,omitempty"`
}

// HelmParameter is a parameter that's passed to helm template during manifest generation
type HelmParameter struct {
	// Name is the name of the Helm parameter
	Name string `json:"name,omitempty"`
	// Value is the value for the Helm parameter
	Value string `json:"value,omitempty"`
	// ForceString determines whether to tell Helm to interpret booleans and numbers as strings
	ForceString bool `json:"forceString,omitempty"`
}

type ApplicationSpec struct {
	// Name of the application to deploy
	Name string `json:"name,omitempty"`
	// Specifies the list of dependecies in other applications
	Needs []string `json:"needs,omitempty"`
	// Config is a reference to the location of the application's manifests or chart
	Config ApplicationConfig `json:"config" protobuf:"bytes,1,opt,name=source"`
}

// OrchestClusterSpec describes the attributes that a user creates on a OrchestCluster.
type OrchestClusterSpec struct {
	// Wether Orchest is Single Node or not, if specified, all pods of the orchest
	// including session pods will be scheduled on the same node.
	SingleNode *bool `json:"singleNode,omitempty"`

	// NodeSelector is a selector which must be true for the pod to fit on a node.
	// Selector which must match a node's labels for the pod to be scheduled on that node.
	// More info: https://kubernetes.io/docs/concepts/configuration/assign-pod-node/
	// If single node is specified, node-selector will be chosed automatically by controller
	DefaultNodeSelector map[string]string `json:"nodeSelector,omitempty"`

	Orchest OrchestSpec `json:"orchest,omitempty"`

	Postgres OrchestComponentTemplate `json:"postgres,omitempty"`

	RabbitMq OrchestComponentTemplate `json:"rabbitMq,omitempty"`

	Applications map[string]ApplicationSpec `json:"applications,omitempty"`
}

type Condition struct {
	Event              string      `json:"event,omitempty"`
	LastHeartbeatTime  metav1.Time `json:"lastHeartbeatTime,omitempty"`
	LastTransitionTime metav1.Time `json:"lastTransitionTime,omitempty"`
}

// OrchestClusterStatus defines the status of OrchestCluster
type OrchestClusterStatus struct {
	// The generation observed by the controller.
	ObservedGeneration int64 `json:"observedGeneration,omitempty"`

	// The observed hash of the spec by the controller.
	ObservedHash string `json:"observedHash,omitempty"`

	Phase OrchestPhase `json:"state,omitempty"`

	Reason string `json:"reason,omitempty"`

	Conditions []Condition `json:"conditions,omitempty"`

	Version string `json:"version,omitempty"`

	LastHeartbeatTime metav1.Time `json:"lastHeartbeatTime,omitempty"`
}

// +genclient
// +kubebuilder:subresource:status
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

// OrchestCluster is the Schema for the Orchest deployment
type OrchestCluster struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   OrchestClusterSpec    `json:"spec,omitempty"`
	Status *OrchestClusterStatus `json:"status,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
// +kubebuilder:object:root=true

// OrchestClusterList contains a list of OrchestCluster
type OrchestClusterList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata"`
	Items           []*OrchestCluster `json:"items"`
}
