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

// PodPhase is a label for the condition of a OrchestCluster at the current time.
type OrchestClusterPhase string

const (
	// OrchestClusterPhase
	Initializing          OrchestClusterPhase = "Initializing"
	DeployingThirdParties OrchestClusterPhase = "Deploying Third Parties"
	DeployedThirdParties  OrchestClusterPhase = "Deployed Third Parties"
	DeployingOrchest      OrchestClusterPhase = "Deploying Orchest Control Plane"
	DeployedOrchest       OrchestClusterPhase = "Deployed Orchest Control Plane"
	Restarting            OrchestClusterPhase = "Restarting"
	Starting              OrchestClusterPhase = "Starting"
	Running               OrchestClusterPhase = "Running"
	Pausing               OrchestClusterPhase = "Pausing"
	Paused                OrchestClusterPhase = "Paused"
	Upgrading             OrchestClusterPhase = "Updating"
	Error                 OrchestClusterPhase = "Error"
	Unknown               OrchestClusterPhase = "Unknown"
	Unhealthy             OrchestClusterPhase = "Unhealthy"
	Deleting              OrchestClusterPhase = "Deleting"

	//Reasons
	DeployingArgo         = "Deploying argo-workflow"
	DeployingCertManager  = "Deploying cert-manager"
	DeployingRegistry     = "Deploying docker-registry"
	DeployingNginxIngress = "Deploying nginx-ingress"

	DeployingOrchestDatabase  = "Deploying orchest-database"
	UpgradingOrchestDatabase  = "Upgrading orchest-database"
	DeployingAuthServer       = "Deploying auth-server"
	UpgradingAuthServer       = "Upgrading auth-server"
	DeployingCeleryWorker     = "Deploying celery-worker"
	UpgradingCeleryWorker     = "Upgrading celery-worker"
	DeployingOrchestApi       = "Deploying orchest-api"
	UpgradingOrchestApi       = "Upgrading orchest-api"
	DeployingOrchestWebserver = "Deploying orchest-webserver"
	UpgradingOrchestWebserver = "Upgrading orchest-webserver"
)

type OrchestResourcesSpec struct {
	// If specified, this components will be deployed provided image
	UserDirVolumeSize string `json:"userDirvolumeSize,omitempty"`

	// If specified, this components will be deployed provided image
	ConfigDirVolumeSize string `json:"configDirVolumeSize,omitempty"`

	// If specified, this components will be deployed provided image
	BuilderCacheDirVolumeSize string `json:"builderCacheDirVolumeSize,omitempty"`

	// The Storage class of user-dir/
	StorageClassName string `json:"storageClassName,omitempty"`
}

type OrchestComponent struct {
	//If specified, this components will be deployed provided image
	Image string `json:"image,omitempty"`

	// List of environment variables to set in the container.
	Env []corev1.EnvVar `json:"env,omitempty"`

	// NodeSelector is a selector which must be true for the pod to fit on a node.
	// Selector which must match a node's labels for the pod to be scheduled on that node.
	// More info: https://kubernetes.io/docs/concepts/configuration/assign-pod-node/
	NodeSelector map[string]string `json:"nodeSelector,omitempty"`
}

// OrchestSpec describes the attributes of orchest components.
type OrchestSpec struct {

	// Indicate if the cluster is in Pause state or not
	Pause *bool `json:"pause,omitempty"`

	Registry string `json:"registry,omitempty"`
	Version  string `json:"version,omitempty"`

	Env []corev1.EnvVar `json:"env,omitempty"`

	// orchest resources spec, such as user-dir volume size and storage class
	Resources OrchestResourcesSpec `json:"resources,omitempty"`

	// If specified, orchest-api for this cluster will be deployed with this configuration
	OrchestApi OrchestComponent `json:"orchestApi,omitempty"`

	// If specified, orchest-webserver for this cluster will be deployed with this configuration
	OrchestWebServer OrchestComponent `json:"orchestWebServer,omitempty"`

	// If specified, celery-worker for this cluster will be deployed with this configuration
	CeleryWorker OrchestComponent `json:"celeryWorker,omitempty"`

	// If specified, node-agent for this cluster will be deployed with this configuration
	NodeAgent OrchestComponent `json:"nodeAgent,omitempty"`

	// If specified, auth-server for this cluster will be deployed with this configuration
	AuthServer OrchestComponent `json:"authServer,omitempty"`
}

// RegistrySpec describes the attributes of docker-registry which will be used by step containers.
type DockerRegistrySpec struct {
	Name string `json:"image,omitempty" helm:"fullnameOverride"`

	// NodeSelector is a selector which must be true for the pod to fit on a node.
	// Selector which must match a node's labels for the pod to be scheduled on that node.
	// More info: https://kubernetes.io/docs/concepts/configuration/assign-pod-node/
	NodeSelector map[string]string `json:"nodeSelector,omitempty"`

	VolumeSize string `json:"volumeSize,omitempty" helm:"persistence.size"`

	StorageClass string `json:"storageClass,omitempty" helm:"persistence.storageClass"`
}

// PostgresSpec describes the attributes of postgres which will be used by orchest components.
type PostgresSpec struct {
	Image string `json:"image,omitempty"`

	// NodeSelector is a selector which must be true for the pod to fit on a node.
	// Selector which must match a node's labels for the pod to be scheduled on that node.
	// More info: https://kubernetes.io/docs/concepts/configuration/assign-pod-node/
	NodeSelector map[string]string `json:"nodeSelector,omitempty"`
}

// RabbitMq describes the attributes of rabbit which will be used by orchest components.
type RabbitMQSpec struct {
	Image string `json:"image,omitempty"`

	// NodeSelector is a selector which must be true for the pod to fit on a node.
	// Selector which must match a node's labels for the pod to be scheduled on that node.
	// More info: https://kubernetes.io/docs/concepts/configuration/assign-pod-node/
	NodeSelector map[string]string `json:"nodeSelector,omitempty"`
}

// OrchestClusterSpec describes the attributes that a user creates on a OrchestCluster.
type OrchestClusterSpec struct {
	// Wether Orchest is Single Node or not, if specified, all pods of the orchest
	// including session pods will be scheduled on the same node.
	SingleNode bool `json:"singleNode,omitempty"`

	// NodeSelector is a selector which must be true for the pod to fit on a node.
	// Selector which must match a node's labels for the pod to be scheduled on that node.
	// More info: https://kubernetes.io/docs/concepts/configuration/assign-pod-node/
	// If single node is specified, node-selector will be chosed automatically by controller
	DefaultNodeSelector map[string]string `json:"nodeSelector,omitempty"`

	Orchest OrchestSpec `json:"orchest,omitempty"`

	Registry DockerRegistrySpec `json:"registry,omitempty"`

	Postgres PostgresSpec `json:"postgres,omitempty"`

	RabbitMq RabbitMQSpec `json:"rabbitMq,omitempty"`
}

type Condition struct {
	Type               OrchestClusterPhase    `json:"type,omitempty"`
	Status             corev1.ConditionStatus `json:"status,omitempty"`
	Reason             string                 `json:"reason,omitempty"`
	Message            string                 `json:"message,omitempty"`
	LastHeartbeatTime  metav1.Time            `json:"lastHeartbeatTime,omitempty"`
	LastTransitionTime metav1.Time            `json:"lastTransitionTime,omitempty"`
}

// OrchestClusterStatus defines the status of OrchestCluster
type OrchestClusterStatus struct {
	// The generation observed by the controller.
	ObservedGeneration int64 `json:"observedGeneration,omitempty" protobuf:"varint,1,opt,name=observedGeneration"`

	// The observed hash of the spec by the controller.
	ObservedHash string `json:"observedHash,omitempty" protobuf:"varint,1,opt,name=observedGeneration"`

	Phase OrchestClusterPhase `json:"state,omitempty"`

	Reason string `json:"reason,omitempty"`

	Conditions []Condition `json:"conditions,omitempty"`

	Version string `json:"version,omitempty"`
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
