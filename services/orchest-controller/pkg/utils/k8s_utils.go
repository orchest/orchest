package utils

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"time"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/certs"
	"github.com/orchest/orchest/services/orchest-controller/pkg/client/clientset/versioned"
	ocinformersfactory "github.com/orchest/orchest/services/orchest-controller/pkg/client/informers/externalversions"
	orchestinformers "github.com/orchest/orchest/services/orchest-controller/pkg/client/informers/externalversions/orchest/v1alpha1"
	"github.com/pkg/errors"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/strategicpatch"
	"k8s.io/client-go/informers"
	appsinformers "k8s.io/client-go/informers/apps/v1"
	coreinformers "k8s.io/client-go/informers/core/v1"
	netsinformers "k8s.io/client-go/informers/networking/v1"
	rbacinformers "k8s.io/client-go/informers/rbac/v1"
	"k8s.io/client-go/kubernetes"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
	_ "k8s.io/client-go/plugin/pkg/client/auth"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/klog/v2"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/client/apiutil"
)

type KubernetesDistros string

const (
	CACertificateKey = "ca.crt"

	// Kubernetes distributions
	NotDetected   KubernetesDistros = ""
	Minikube      KubernetesDistros = "minikube"
	Microk8s      KubernetesDistros = "microk8s"
	EKS           KubernetesDistros = "eks"
	GKE           KubernetesDistros = "gke"
	K3s           KubernetesDistros = "k3s"
	DockerDesktop KubernetesDistros = "docker-desktop"

	// Detection lables
	minikubeLableKey        = "minikube.k8s.io/name"
	microk8sLabelKey        = "node.kubernetes.io/microk8s-controlplane"
	k3sAnnotationKey        = "k3s.io/hostname"
	eksLabelKey             = "k8s.io/cloud-provider-aws"
	gkeLabelKey             = "topology.gke.io/zone"
	dockerDesktopLabelKey   = "kubernetes.io/hostname"
	dockerDesktopLabelValue = "docker-desktop"
)

func GetClientsOrDie(inCluster bool, scheme *runtime.Scheme) (
	kubernetes.Interface,
	versioned.Interface,
	client.Client) {

	var config *rest.Config
	var err error
	if inCluster {
		config, err = rest.InClusterConfig()
		if err != nil {
			klog.Fatalf("Can not get kubernetes config: %v", err)
		}
	} else {
		config, err = BuildOutsideClusterConfig()
		if err != nil {
			klog.Fatalf("Can not get kubernetes config: %v", err)
		}
	}

	kClient, err := kubernetes.NewForConfig(config)
	if err != nil {
		klog.Fatalf("Can not create kubernetes client: %v", err)
	}

	oClient, err := versioned.NewForConfig(config)
	if err != nil {
		klog.Fatalf("Can not get orchest client: %v", err)
	}

	mapper, err := apiutil.NewDynamicRESTMapper(config)
	if err != nil {
		klog.Fatalf("Can not get rest mapper: %v", err)
	}

	clientOptions := client.Options{Scheme: scheme, Mapper: mapper}

	gClient, err := client.New(config, clientOptions)
	if err != nil {
		klog.Fatalf("Can not general kubernetes client: %v", err)
	}

	return kClient, oClient, gClient
}

func GetScheme() *runtime.Scheme {

	scheme := runtime.NewScheme()
	clientgoscheme.AddToScheme(scheme)
	orchestv1alpha1.AddToScheme(scheme)
	apiextensionsv1.AddToScheme(scheme)

	return scheme
}

// BuildOutsideClusterConfig returns k8s config
func BuildOutsideClusterConfig() (*rest.Config, error) {
	kubeConfig := GetEnvOrDefault("KUBECONFIG", "~/.kube/config")

	config, err := clientcmd.BuildConfigFromFlags("", kubeConfig)
	if err != nil {
		return nil, errors.Wrap(err, "faile to build")
	}
	return config, nil
}

func GetEnvOrDefault(key, defaultValue string) string {

	value := os.Getenv("KUBECONFIG")
	if value == "" {
		value = defaultValue
	}

	return value
}

func NewOrchestClusterInformer(ocClient versioned.Interface) orchestinformers.OrchestClusterInformer {
	orchestInformerFactory := ocinformersfactory.NewSharedInformerFactory(ocClient, time.Second)
	return orchestInformerFactory.Orchest().V1alpha1().OrchestClusters()
}

func NewOrchestComponentInformer(ocClient versioned.Interface) orchestinformers.OrchestComponentInformer {
	orchestInformerFactory := ocinformersfactory.NewSharedInformerFactory(ocClient, time.Second)
	return orchestInformerFactory.Orchest().V1alpha1().OrchestComponents()
}

func NewInformerFactory(client kubernetes.Interface) informers.SharedInformerFactory {
	return informers.NewSharedInformerFactoryWithOptions(client, time.Second*30)
}

func NewDeploymentInformer(factory informers.SharedInformerFactory) appsinformers.DeploymentInformer {
	return factory.Apps().V1().Deployments()
}

func NewHistoryInformer(factory informers.SharedInformerFactory) appsinformers.ControllerRevisionInformer {
	return factory.Apps().V1().ControllerRevisions()
}

func NewDaemonSetInformer(factory informers.SharedInformerFactory) appsinformers.DaemonSetInformer {
	return factory.Apps().V1().DaemonSets()
}

func NewIngressInformer(factory informers.SharedInformerFactory) netsinformers.IngressInformer {
	return factory.Networking().V1().Ingresses()
}

func NewServiceInformer(factory informers.SharedInformerFactory) coreinformers.ServiceInformer {
	return factory.Core().V1().Services()
}

func NewServiceAccountInformer(factory informers.SharedInformerFactory) coreinformers.ServiceAccountInformer {
	return factory.Core().V1().ServiceAccounts()
}

func NewrClusterRoleInformer(factory informers.SharedInformerFactory) rbacinformers.ClusterRoleInformer {
	return factory.Rbac().V1().ClusterRoles()
}

func NewClusterRoleBindingInformer(factory informers.SharedInformerFactory) rbacinformers.ClusterRoleBindingInformer {
	return factory.Rbac().V1().ClusterRoleBindings()
}

func DetectK8sDistribution(client kubernetes.Interface) KubernetesDistros {
	nodes, err := client.CoreV1().Nodes().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		klog.Errorf("Failed to get node list: %v", err)
		return NotDetected
	}
	if len(nodes.Items) <= 0 {
		return NotDetected
	}

	node := nodes.Items[0]

	if _, ok := node.Labels[minikubeLableKey]; ok {
		return Minikube
	} else if _, ok := node.Labels[microk8sLabelKey]; ok {
		return Microk8s
	} else if _, ok := node.Labels[eksLabelKey]; ok {
		return EKS
	} else if _, ok := node.Labels[gkeLabelKey]; ok {
		return GKE
	} else if _, ok := node.Annotations[k3sAnnotationKey]; ok {
		return K3s
	} else if value, ok := node.Labels[dockerDesktopLabelKey]; ok && value == dockerDesktopLabelValue {
		return DockerDesktop
	}

	return NotDetected
}

// IsDeploymentReady checks if the number of required replicas is equal to number of created replicas
func IsDeploymentReady(ctx context.Context, client kubernetes.Interface, name, namespace string) bool {

	deployment, err := client.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		if kerrors.IsNotFound(err) {
			klog.V(2).Info("deployment %s resource not found.", name)
		}
		// Error reading Deployment.
		return false
	}

	// Replicas is not intialized yet
	if deployment.Spec.Replicas == nil {
		return false
	}

	return *deployment.Spec.Replicas == deployment.Status.ReadyReplicas
}

// IsDeploymentPaused checks if the deployment is paused
func IsDeploymentPaused(ctx context.Context, client kubernetes.Interface, name, namespace string) bool {

	deployment, err := client.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		if kerrors.IsNotFound(err) {
			klog.V(2).Info("deployment %s resource not found.", name)
		}
		// Error reading Deployment.
		return false
	}

	// Replicas is not intialized yet
	if deployment.Spec.Replicas == nil {
		return false
	}

	return *deployment.Spec.Replicas == deployment.Status.ReadyReplicas
}

func IsPodActive(ctx context.Context, client kubernetes.Interface, pod *corev1.Pod) bool {
	return corev1.PodSucceeded != pod.Status.Phase &&
		corev1.PodFailed != pod.Status.Phase
}

func GetFullImageName(registry, imageName, tag string) string {
	if tag == "" {
		tag = "latest"
	}
	if registry != "" {
		return fmt.Sprintf("%s/orchest/%s:%s", registry, imageName, tag)
	}

	return fmt.Sprintf("orchest/%s:%s", imageName, tag)
}

func GetPatchData(oldObj, newObj interface{}) ([]byte, error) {
	oldData, err := json.Marshal(oldObj)
	if err != nil {
		return nil, fmt.Errorf("marshal old object failed: %v", err)
	}
	newData, err := json.Marshal(newObj)
	if err != nil {
		return nil, fmt.Errorf("marshal new object failed: %v", err)
	}
	patchBytes, err := strategicpatch.CreateTwoWayMergePatch(oldData, newData, oldObj)
	if err != nil {
		return nil, fmt.Errorf("CreateTwoWayMergePatch failed: %v", err)
	}
	return patchBytes, nil
}

func GetInstanceOfObj(obj interface{}) client.Object {
	switch obj.(type) {
	case *corev1.Service:
		return &corev1.Service{}
	case *corev1.ServiceAccount:
		return &corev1.ServiceAccount{}
	case *appsv1.Deployment:
		return &appsv1.Deployment{}
	case *appsv1.DaemonSet:
		return &appsv1.DaemonSet{}
	case *rbacv1.ClusterRole:
		return &rbacv1.ClusterRole{}
	case *rbacv1.ClusterRoleBinding:
		return &rbacv1.ClusterRoleBinding{}
	case *rbacv1.Role:
		return &rbacv1.Role{}
	case *rbacv1.RoleBinding:
		return &rbacv1.RoleBinding{}
	case *networkingv1.Ingress:
		return &networkingv1.Ingress{}
	}
	return nil
}

func GetKeyFromEnvVar(envVars []corev1.EnvVar, key string) string {

	for _, envVar := range envVars {
		if envVar.Name == key {
			return envVar.Value
		}
	}

	return ""
}

func GetEnvVarFromMap(envVars map[string]string) []corev1.EnvVar {

	result := make([]corev1.EnvVar, 0, len(envVars))
	for name, value := range envVars {
		result = append(result, corev1.EnvVar{Name: name, Value: value})
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].Name < result[j].Name
	})

	return result
}

func GetMapFromEnvVar(envVarLists ...[]corev1.EnvVar) map[string]string {
	length := 0
	for _, envVarList := range envVarLists {
		length += len(envVarList)
	}

	mapEnvVars := make(map[string]string, length)

	for _, envVars := range envVarLists {
		for _, envVar := range envVars {
			mapEnvVars[envVar.Name] = envVar.Value
		}
	}

	return mapEnvVars
}

func MergeEnvVars(envVarLists ...[]corev1.EnvVar) []corev1.EnvVar {
	envMap := GetMapFromEnvVar(envVarLists...)
	return GetEnvVarFromMap(envMap)
}

// UpsertEnvVariable inserts the env variable from map to the list is not exist or update it
// if replace it true and returns true if changed the envVarList
func UpsertEnvVariable(envVarList *[]corev1.EnvVar, eEnvVarMap map[string]string, update bool) bool {

	changed := false
	envVarMap := GetMapFromEnvVar(*envVarList)

	for defaultName, defaultValue := range eEnvVarMap {
		if value, ok := envVarMap[defaultName]; !ok || (update && value != defaultValue) {
			envVarMap[defaultName] = defaultValue
			*envVarList = append(*envVarList, corev1.EnvVar{Name: defaultName, Value: defaultValue})
			changed = true
		}
	}

	return changed
}

func CloneLabel(labels map[string]string) map[string]string {

	// Clone labels
	newLabels := map[string]string{}
	for key, value := range labels {
		newLabels[key] = value
	}

	return newLabels
}

func AddLabel(labels, addLabels map[string]string) {

	// Clone labels
	// Add labels
	for key, value := range addLabels {
		labels[key] = value
	}
}

func CloneAndAddLabel(labels, addLabels map[string]string) map[string]string {
	if len(addLabels) == 0 {
		return labels
	}

	newLabels := CloneLabel(labels)

	AddLabel(newLabels, addLabels)

	return newLabels
}

// This function is borrowed from projectcountour
// OutputCerts outputs the certs in certs as directed by config.
func OutputCerts(ctx context.Context, namespace string, owner metav1.OwnerReference,
	client kubernetes.Interface, certs *certs.Certificates) error {
	var secrets []*corev1.Secret

	secrets, err := AsSecrets(namespace, owner, certs)
	if err != nil {
		return errors.Wrap(err, "Failed to create secret from cets")
	}

	klog.Infof("Writing Secrets to namespace %q\n", namespace)
	if err := WriteSecretsKube(ctx, client, secrets); err != nil {
		return fmt.Errorf("failed to write certificates to %q: %w", namespace, err)
	}

	return nil
}

// This function is borrowed from projectcountour
// WriteSecretsKube writes all the keypairs out to Kubernetes Secrets in the
// compact format which is compatible with Secrets generated by cert-manager.
func WriteSecretsKube(ctx context.Context, client kubernetes.Interface, secrets []*corev1.Secret) error {
	for _, s := range secrets {
		if _, err := client.CoreV1().Secrets(s.Namespace).Create(ctx, s, metav1.CreateOptions{}); err != nil {
			if err != nil && !kerrors.IsAlreadyExists(err) {
				return err
			}

			//if _, err := client.CoreV1().Secrets(s.Namespace).Update(ctx, s, metav1.UpdateOptions{}); err != nil {
			//	return err
			//}
		}

		klog.Infof("secret/%s updated\n", s.Name)
	}

	return nil
}

// This function is borrowed from projectcountour
// AsSecrets transforms the given Certificates struct into a slice of
// Secrets in in compact Secret format, which is compatible with
// both cert-manager and Contour.
func AsSecrets(namespace string, owner metav1.OwnerReference, certdata *certs.Certificates) ([]*corev1.Secret, error) {

	return []*corev1.Secret{
		newSecret(
			corev1.SecretTypeTLS,
			"registry-tls-secret",
			namespace,
			owner,
			map[string][]byte{
				CACertificateKey:        certdata.CACertificate,
				corev1.TLSCertKey:       certdata.RegistryCertificate,
				corev1.TLSPrivateKeyKey: certdata.RegistryPrivateKey,
			}),
	}, nil
}

// This function is borrowed from projectcountour
func newSecret(secretType corev1.SecretType, name string, namespace string,
	owner metav1.OwnerReference, data map[string][]byte) *corev1.Secret {
	return &corev1.Secret{
		Type: secretType,
		TypeMeta: metav1.TypeMeta{
			Kind:       "Secret",
			APIVersion: "v1",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
			Labels: map[string]string{
				"app": "docker-registry",
			},
			OwnerReferences: []metav1.OwnerReference{
				owner,
			},
		},
		Data: data,
	}
}
