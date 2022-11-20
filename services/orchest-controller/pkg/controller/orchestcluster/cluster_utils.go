package orchestcluster

import (
	"bytes"
	"fmt"
	"net"
	"regexp"
	"sort"
	"strings"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	orchestlisters "github.com/orchest/orchest/services/orchest-controller/pkg/client/listers/orchest/v1alpha1"
	registry "github.com/orchest/orchest/services/orchest-controller/pkg/componentregistry"
	"github.com/orchest/orchest/services/orchest-controller/pkg/controller"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/klog/v2"
)

type setThirdPartyConfigFunc func(string, kubernetes.Interface, utils.KubernetesDistros, *orchestv1alpha1.OrchestCluster) bool

var (
	creationStages = [][]string{
		{controller.OrchestDatabase, controller.Rabbitmq, controller.BuildKitDaemon},
		{controller.OrchestApi, controller.AuthServer},
		{controller.CeleryWorker, controller.NodeAgent},
		{controller.OrchestWebserver},
	}

	thirdPartyConfigFuncs = map[string]setThirdPartyConfigFunc{
		registry.ArgoWorkflow:   setDefaultConfig,
		registry.DockerRegistry: setDockerRegistryConfig,
		registry.IngressNginx:   setIngressConfig,
		registry.EfsCsiDriver:   setEFSConfig,
		registry.NvidiaPlugin:   setNvidiaConfig,
	}

	defaultStorageClassAnnotation = "storageclass.kubernetes.io/is-default-class"

	legacyDefaultDomain = "index.docker.io"
	defaultDomain       = "docker.io"
	// Registry helm parameters
	registryServiceIP = "service.clusterIP"
)

// set the config for a third party components, and return true if it changes the OrchestCluster

func determineNextPhase(orchest *orchestv1alpha1.OrchestCluster) (
	orchestv1alpha1.OrchestPhase, orchestv1alpha1.OrchestPhase) {

	// Next phase is the phase the OrchestCluster will enter
	var nextPhase orchestv1alpha1.OrchestPhase

	// After nextPhase is finished, the OrchestCluster will enter endPhase
	var endPhase orchestv1alpha1.OrchestPhase

	// The current phase of the cluster
	curPhase := orchest.Status.Phase

	if !orchest.GetDeletionTimestamp().IsZero() {
		// If the cluster is removed, we enter deleting phase
		nextPhase = orchestv1alpha1.Deleting
	} else if curPhase == orchestv1alpha1.Initializing {
		// If the object is just created the third-parties should be deployed
		nextPhase = orchestv1alpha1.DeployingThirdParties

		endPhase = orchestv1alpha1.DeployedThirdParties
	} else if *orchest.Spec.Orchest.Pause && curPhase != orchestv1alpha1.Stopped {
		// If the cluster needs to be paused but not paused yet
		nextPhase = orchestv1alpha1.Stopping

		endPhase = orchestv1alpha1.Stopped

	} else if *orchest.Spec.Orchest.Pause && curPhase == orchestv1alpha1.Stopped {
		// If the cluster needs to be paused and already paused
		nextPhase = orchestv1alpha1.Stopped

		endPhase = orchestv1alpha1.Stopped

	} else if !*orchest.Spec.Orchest.Pause && curPhase == orchestv1alpha1.Stopped {
		// If cluster is stopped but the pause is false
		nextPhase = orchestv1alpha1.Starting

		endPhase = orchestv1alpha1.Running

	} else if (curPhase == orchestv1alpha1.Starting || curPhase == orchestv1alpha1.DeployingOrchest) &&
		(orchest.Status.ObservedHash == utils.ComputeHash(&orchest.Spec)) {
		// If cluster is starting, and the hash is not changed, then the next phase would be Starting again
		nextPhase = curPhase

		endPhase = orchestv1alpha1.Running
	} else if curPhase == orchestv1alpha1.DeployingThirdParties {
		// If the cluster is deploying third parties, it should continue deploying, and
		// will enter deployed once finished
		nextPhase = curPhase

		endPhase = orchestv1alpha1.DeployedThirdParties

	} else if curPhase == orchestv1alpha1.DeployedThirdParties {
		nextPhase = orchestv1alpha1.DeployingOrchest

		endPhase = orchestv1alpha1.Running
	} else if orchest.Status.ObservedGeneration != orchest.Generation {
		// If the hash is changed, the cluster enters upgrading state and then running
		nextPhase = orchestv1alpha1.Updating

		endPhase = orchestv1alpha1.Stopped

	} else if _, ok := orchest.GetAnnotations()[controller.RestartAnnotationKey]; ok {
		// If restart annotation is present, cluster enters pausing phase then running
		nextPhase = orchestv1alpha1.Stopping

		endPhase = orchestv1alpha1.Stopped

	} else if curPhase == orchestv1alpha1.Stopping {
		// If we are here the restart annotation is removed so we need to enter starting phase
		nextPhase = orchestv1alpha1.Starting

		endPhase = orchestv1alpha1.Running
	} else {

		nextPhase = curPhase
		endPhase = orchestv1alpha1.Running
	}

	return nextPhase, endPhase
}

// GetOrchestComponents returns all the components of the OrchestCluster
func GetOrchestComponents(ctx context.Context,
	orchest *orchestv1alpha1.OrchestCluster,
	lister orchestlisters.OrchestComponentLister) (
	map[string]*orchestv1alpha1.OrchestComponent, error) {

	selector, err := controller.GetOrchestLabelSelector(orchest)
	if err != nil {
		return nil, err
	}

	// List the orchest components
	components, err := lister.OrchestComponents(orchest.Namespace).List(selector)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get components of OrchestCluser=%s", orchest.Name)
	}

	// now we iterate over the all the resources
	componentMap := make(map[string]*orchestv1alpha1.OrchestComponent, len(components))
	for _, component := range components {
		componentMap[component.Name] = component
	}

	return componentMap, nil
}

func GetComponentTemplate(name string, orchest *orchestv1alpha1.OrchestCluster) (
	*orchestv1alpha1.OrchestComponentTemplate, error) {
	var componentTemplate *orchestv1alpha1.OrchestComponentTemplate

	switch name {
	case controller.OrchestDatabase:
		componentTemplate = orchest.Spec.Postgres.DeepCopy()
	case controller.OrchestApi:
		componentTemplate = orchest.Spec.Orchest.OrchestApi.DeepCopy()
	case controller.Rabbitmq:
		componentTemplate = orchest.Spec.RabbitMq.DeepCopy()
	case controller.CeleryWorker:
		componentTemplate = orchest.Spec.Orchest.CeleryWorker.DeepCopy()
	case controller.AuthServer:
		componentTemplate = orchest.Spec.Orchest.AuthServer.DeepCopy()
	case controller.OrchestWebserver:
		componentTemplate = orchest.Spec.Orchest.OrchestWebServer.DeepCopy()
	case controller.NodeAgent:
		componentTemplate = orchest.Spec.Orchest.NodeAgent.DeepCopy()
	case controller.BuildKitDaemon:
		componentTemplate = orchest.Spec.Orchest.BuildKitDaemon.DeepCopy()
	default:
		return nil, errors.Errorf("unrecognized component name %s", name)
	}

	return componentTemplate, nil
}

func getOrchestComponent(name, hash string,
	template *orchestv1alpha1.OrchestComponentTemplate,
	orchest *orchestv1alpha1.OrchestCluster) *orchestv1alpha1.OrchestComponent {

	metadata := controller.GetMetadata(name, hash, orchest, OrchestClusterKind)

	env := utils.MergeEnvVars(orchest.Spec.Orchest.Env, template.Env)
	template.Env = env

	return &orchestv1alpha1.OrchestComponent{
		ObjectMeta: metadata,
		Spec: orchestv1alpha1.OrchestComponentSpec{
			OrchestHost: orchest.Spec.Orchest.OrchestHost,
			Template:    *template,
		},
	}

}

// nextIP returns the next ip address
func nextIP(ip net.IP, inc uint) net.IP {
	v := uint(ip[0])<<24 + uint(ip[1])<<16 + uint(ip[2])<<8 + uint(ip[3])
	v += inc
	v3 := byte(v & 0xFF)
	v2 := byte((v >> 8) & 0xFF)
	v1 := byte((v >> 16) & 0xFF)
	v0 := byte((v >> 24) & 0xFF)
	return net.IPv4(v0, v1, v2, v3)
}

// detectContainerRuntime detects the container runtime of the cluster and the socket path
// returns error if the container runtime is not supported or the cluster is not homogeneous
// If the socket path is not set or not detected, it will use the default socket path based on
// the container runtime
func detectContainerRuntime(ctx context.Context,
	client kubernetes.Interface, orchest *orchestv1alpha1.OrchestCluster) (string, string, error) {

	// Get the node list
	nodeList, err := client.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return "", "", errors.Wrapf(err, "failed to get node list")
	}

	var runtime = ""
	for _, node := range nodeList.Items {
		// Get the node container runtime
		runtimeVersion := node.Status.NodeInfo.ContainerRuntimeVersion
		if runtimeVersion == "" {
			return "", "", errors.Errorf("failed to get container runtime version")
		}

		// Get the container runtime name
		runtimeName := strings.Split(runtimeVersion, ":")[0]
		if runtimeName != "docker" && runtimeName != "containerd" {
			return "", "", errors.Errorf("unsupported container runtime %s", runtimeName)
		}

		if runtime == "" {
			runtime = runtimeName
			continue
		}

		if runtime != runtimeName {
			return "", "", errors.Errorf("cluster is not homogeneous")
		}
	}

	// Get the container runtime socket path
	runtimeSocket, ok := orchest.Annotations[controller.ContainerRuntimeSocketPathAnnotationKey]
	if !ok {
		// The socket path is not provided in the annotation, so we need to detect it
		if runtime == "containerd" {
			// Get the first node
			node := nodeList.Items[0]
			runtimeSocket, ok = node.Annotations[controller.KubeAdmCRISocketAnnotationKey]
			if !ok {
				// kubeadm CRi socket is not provided in the annotation, so we use the default socket path
				runtimeSocket = "/var/run/containerd/containerd.sock"

			}
		} else {
			// The socket path is not provided in the annotation of OrchestCluster, so we use the default socket path
			runtimeSocket = "/var/run/docker.sock"
		}
	}

	return runtime, runtimeSocket, nil
}

func detectDefaultStorageClass(ctx context.Context, client kubernetes.Interface) (string, error) {

	// Get the storage class lists
	scList, err := client.StorageV1().StorageClasses().List(ctx, metav1.ListOptions{})
	if err != nil {
		return "", errors.Wrapf(err, "failed to get storage class list")
	}

	for _, sc := range scList.Items {
		if value, ok := sc.Annotations[defaultStorageClassAnnotation]; ok && value == "true" {
			return sc.Name, nil
		}
	}

	return "", fmt.Errorf("Failed to get the default StorageClass")
}

// borrowed from https://github.com/distribution/distribution
// splitDockerDomain splits a repository name to domain and remotename string.
// If no valid domain is found, the default domain is used. Repository name
// needs to be already validated before.
func splitDockerDomain(name string) (domain, remainder string) {
	i := strings.IndexRune(name, '/')
	if i == -1 || (!strings.ContainsAny(name[:i], ".:") && name[:i] != "localhost") {
		domain, remainder = "", name
	} else {
		domain, remainder = name[:i], name[i+1:]
	}
	if domain == legacyDefaultDomain {
		domain = defaultDomain
	}

	return
}

func parseImageName(imageName string) (domain, name, tag string) {

	domain, name = splitDockerDomain(imageName)
	tag = "latest"
	if tagSep := strings.IndexRune(name, ':'); tagSep > -1 {
		tag = name[tagSep+1:]
		name = name[:tagSep]
	}

	return
}

func isCalverVersion(version string) bool {
	matched, _ := regexp.MatchString("^v(\\d{4}\\.)(\\d{2}\\.)(\\d+)$", version)
	return matched
}

func isCustomImage(orchest *orchestv1alpha1.OrchestCluster, component, imageName string) bool {

	domain, name, tag := parseImageName(imageName)

	if domain != orchest.Spec.Orchest.Registry ||
		name != "orchest/"+component || !isCalverVersion(tag) {
		return true
	}

	return false
}

func setDefaultConfig(name string, client kubernetes.Interface, distro utils.KubernetesDistros,
	orchest *orchestv1alpha1.OrchestCluster) bool {

	// If the config present, we won't add it
	if _, ok := orchest.Spec.Applications[name]; ok {
		return false
	}
	orchest.Spec.Applications[name] = orchestv1alpha1.ApplicationSpec{
		Name:   name,
		Config: orchestv1alpha1.ApplicationConfig{},
	}
	return true
}

func setArgoWorkflowConfig(name string, client kubernetes.Interface, distro utils.KubernetesDistros,
	orchest *orchestv1alpha1.OrchestCluster) bool {

	// If the config present, we won't add it
	if _, ok := orchest.Spec.Applications[name]; ok {
		return false
	}

	// add controller node-selector labels
	params := make([]orchestv1alpha1.HelmParameter, 0, len(orchest.Spec.ControlNodeSelector))
	for key, value := range orchest.Spec.ControlNodeSelector {
		paramName := "controller.nodeSelector." + strings.Replace(key, ".", "\\.", -1)

		params = append(params, orchestv1alpha1.HelmParameter{
			Name:  paramName,
			Value: value,
		})
	}

	orchest.Spec.Applications[name] = orchestv1alpha1.ApplicationSpec{
		Name: name,
		Config: orchestv1alpha1.ApplicationConfig{
			Helm: &orchestv1alpha1.ApplicationConfigHelm{
				Parameters: params,
			},
		},
	}
	return true

}

func setEFSConfig(name string, client kubernetes.Interface, distro utils.KubernetesDistros,
	orchest *orchestv1alpha1.OrchestCluster) bool {

	// If the config present, we won't add it
	if _, ok := orchest.Spec.Applications[name]; ok {
		return false
	}

	// if file-system id annotation is present
	if fileSystemId, ok := orchest.Annotations[controller.EFSFileSystemId]; ok {

		// add controller node-selector labels
		params := make([]orchestv1alpha1.HelmParameter, 0, len(orchest.Spec.ControlNodeSelector)+1)
		for key, value := range orchest.Spec.ControlNodeSelector {
			paramName := "controller.nodeSelector." + strings.Replace(key, ".", "\\.", -1)

			params = append(params, orchestv1alpha1.HelmParameter{
				Name:  paramName,
				Value: value,
			})
		}

		params = append(params, orchestv1alpha1.HelmParameter{
			Name:  "storageClasses[0].parameters.fileSystemId",
			Value: fileSystemId,
		})

		orchest.Spec.Applications[name] = orchestv1alpha1.ApplicationSpec{
			Name: name,
			Config: orchestv1alpha1.ApplicationConfig{
				Helm: &orchestv1alpha1.ApplicationConfigHelm{
					Parameters: params,
				},
			},
		}
		return true
	}

	return false
}

func setDockerRegistryConfig(name string, client kubernetes.Interface, distro utils.KubernetesDistros,
	orchest *orchestv1alpha1.OrchestCluster) bool {

	// set docker-registry default values
	var changed = false
	app, ok := orchest.Spec.Applications[name]
	if !ok {
		app = orchestv1alpha1.ApplicationSpec{
			Name: name,
			Config: orchestv1alpha1.ApplicationConfig{
				Helm: &orchestv1alpha1.ApplicationConfigHelm{},
			},
		}
		orchest.Spec.Applications[name] = app
	}

	// We first check if there is an IP assigned by the controller for the service in Config
	// then we check the actual IP of the service if exists, and if they are different the actual
	// IP takes precedence and the configured IP will be changed to the actual one, (this is to
	// fix the issue of the instances updated to v2022.07.6 because, controller in that version
	// assigned the service IP, regardless of the IP of the present service.) If there was
	// no service, we just find a free IP and set it in the configs

	// We check the current controller assigned service IP first
	serviceIpIndex := -1
	for index, param := range app.Config.Helm.Parameters {
		if param.Name == registryServiceIP {
			serviceIpIndex = index
			break
		}
	}

	//Now we get the ClusterIP of the service if present
	var currentIP string
	registryService, err := client.CoreV1().Services(orchest.Namespace).Get(context.Background(), registry.DockerRegistry, metav1.GetOptions{})
	if err != nil {
		if !kerrors.IsNotFound(err) {
			return false
		}
	} else {
		currentIP = registryService.Spec.ClusterIP
	}

	// If the service is present
	if currentIP != "" {
		if serviceIpIndex >= 0 {
			changed = app.Config.Helm.Parameters[serviceIpIndex].Value != currentIP || changed
			app.Config.Helm.Parameters[serviceIpIndex].Value = currentIP
			return changed
		} else {
			changed = true
			app.Config.Helm.Parameters = append(app.Config.Helm.Parameters,
				orchestv1alpha1.HelmParameter{
					Name:  registryServiceIP,
					Value: currentIP,
				})
			return changed
		}
	}

	if serviceIpIndex >= 0 {
		// If we are here, it means the the ip is already configured
		return changed
	}

	// the service ip is not defined, let's find a free IP
	serviceList, err := client.CoreV1().Services("").List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return changed
	}

	// Sort the ip addresses
	sort.Slice(serviceList.Items, func(i, j int) bool {

		ip1 := net.ParseIP(serviceList.Items[i].Spec.ClusterIP).To4()
		if ip1 == nil {
			return false
		}

		ip2 := net.ParseIP(serviceList.Items[j].Spec.ClusterIP).To4()
		if ip2 == nil {
			return false
		}

		return bytes.Compare(ip1, ip2) < 0

	})

	// Find the first free IP
	var serviceIP string
	for i := 0; i < len(serviceList.Items)-1; i++ {

		if serviceList.Items[i].Spec.ClusterIP == "" {
			continue
		}

		nextIP := nextIP(net.ParseIP(serviceList.Items[i].Spec.ClusterIP).To4(), 1)
		if nextIP == nil {
			continue
		}

		// If next ip is not free
		if nextIP.Equal(net.ParseIP(serviceList.Items[i+1].Spec.ClusterIP)) {
			continue
		}

		serviceIP = nextIP.To4().String()
		break
	}

	if serviceIP == "" {
		lastIP := net.ParseIP(serviceList.Items[len(serviceList.Items)-1].
			Spec.ClusterIP)
		if lastIP != nil {
			return changed
		}
		lastIP = lastIP.To4()

		serviceIP = nextIP(lastIP, 1).To4().String()
	}

	changed = true

	// add controller node-selector labels
	params := make([]orchestv1alpha1.HelmParameter, 0, len(orchest.Spec.ControlNodeSelector)+1)
	for key, value := range orchest.Spec.ControlNodeSelector {
		paramName := "nodeSelector." + strings.Replace(key, ".", "\\.", -1)

		params = append(params, orchestv1alpha1.HelmParameter{
			Name:  paramName,
			Value: value,
		})
	}

	// add service-ip
	params = append(params, orchestv1alpha1.HelmParameter{
		Name:  registryServiceIP,
		Value: serviceIP,
	})

	app.Config.Helm.Parameters = append(app.Config.Helm.Parameters, params...)

	return changed
}

func setNvidiaConfig(name string, client kubernetes.Interface, distro utils.KubernetesDistros,
	orchest *orchestv1alpha1.OrchestCluster) bool {
	// GKE installs the nvidia device plugin itself
	if distro == utils.GKE {
		return false
	}
	return setDefaultConfig(name, client, distro, orchest)
}

func setIngressConfig(name string, client kubernetes.Interface, distro utils.KubernetesDistros,
	orchest *orchestv1alpha1.OrchestCluster) bool {

	if distro == utils.NotDetected {
		klog.Error("Failed to detect k8s distribution")
		return false
	}

	switch distro {
	case utils.K3s, utils.EKS, utils.GKE, utils.DockerDesktop:
		if !isNginxIngressInstalled(client) {
			return false
		}
	default:
		return false
	}

	return setDefaultConfig(name, client, distro, orchest)
}

func isNginxIngressInstalled(client kubernetes.Interface) bool {

	// Detect ingress class name
	ingressClasses, err := client.NetworkingV1().IngressClasses().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return false
	}

	for _, ingressClass := range ingressClasses.Items {
		if controller.IsNginxIngressClass(ingressClass.Spec.Controller) {
			return true
		}
	}

	return false

}

func syncThirdPartyApplication(client kubernetes.Interface, appName string,
	orchest *orchestv1alpha1.OrchestCluster, distro utils.KubernetesDistros, setConfig setThirdPartyConfigFunc) bool {

	changed := false
	value, ok := orchest.Annotations[controller.GetAppAnnotationKey(appName)]

	// the annotation for the application is present
	if ok {
		// it has to be enaled, if not yet
		if value == "true" {
			if _, ok := orchest.Spec.Applications[appName]; !ok {
				return setConfig(appName, client, distro, orchest)
			}
		} else if value == "false" {
			// it has to be removed, if enabled
			if _, ok := orchest.Spec.Applications[appName]; ok {
				delete(orchest.Spec.Applications, appName)
				changed = true
			}
		}
	} // if the annotation is not present, the we leave the applications alone

	return changed
}

func isUpdateRequired(orchest *orchestv1alpha1.OrchestCluster, component, imageName string) (newImage string, update bool) {

	update = false
	newImage = utils.GetFullImageName(orchest.Spec.Orchest.Registry, component, orchest.Spec.Orchest.Version)

	if imageName != "" && isCustomImage(orchest, component, imageName) {
		return
	}

	if newImage == imageName {
		return
	}

	update = true
	return

}
