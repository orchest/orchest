# Argo Workflows Chart

This is a **community maintained** chart. It is used to set up argo and it's needed dependencies through one command. This is used in conjunction with [helm](https://github.com/kubernetes/helm).

If you want your deployment of this helm chart to most closely match the [argo CLI](https://github.com/argoproj/argo-workflows), you should deploy it in the `kube-system` namespace.

## Pre-Requisites

This chart uses an install hook to configure the CRD definition. Installation of CRDs is a somewhat privileged process in itself and in RBAC enabled clusters the `default` service account for namespaces does not typically have the ability to do create these.

A few options are:

- Manually create a ServiceAccount in the Namespace which your release will be deployed w/ appropriate bindings to perform this action and set the `serviceAccountName` field in the Workflow spec
- Augment the `default` ServiceAccount permissions in the Namespace in which your Release is deployed to have the appropriate permissions

## Usage Notes

### Workflow controller

This chart defaults to setting the `controller.instanceID.enabled` to `false` now, which means the deployed controller will act upon any workflow deployed to the cluster. If you would like to limit the behavior and deploy multiple workflow controllers, please use the `controller.instanceID.enabled` attribute along with one of it's configuration options to set the `instanceID` of the workflow controller to be properly scoped for your needs.

### Workflow server authentication

By default, the chart requires some kind of authentication mechanism. This adopts the [default behaviour from the Argo project](https://github.com/argoproj/argo-workflows/pull/5211) itself. However, for local development purposes, or cases where your gateway authentication is covered by some other means, you can set the authentication mode for the Argo server by setting the `server.extraArgs: [--auth-mode=server]`. There are a few additional comments in the values.yaml file itself, including commented-out settings to disable authentication on the server UI itself using the same `--auth-mode=server` setting.

## Values

The `values.yaml` contains items used to tweak a deployment of this chart.
Fields to note:

- `controller.instanceID.enabled`: If set to true, the Argo Controller will **ONLY** monitor Workflow submissions with a `--instanceid` attribute
- `controller.instanceID.useReleaseName`: If set to true then chart set controller instance id to release name
- `controller.instanceID.explicitID`: Allows customization of an instance id for the workflow controller to monitor
- `singleNamespace`:  When true, restricts the workflow controller to operate
  in just the single namespace (that one of the Helm release).
- `controller.workflowNamespaces`: This is a list of namespaces where the
  workflow controller will manage workflows. Only valid when `singleNamespace`
  is false.

### General parameters

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| createAggregateRoles | bool | `true` | Create clusterroles that extend existing clusterroles to interact with argo-cd crds |
| fullnameOverride | string | `nil` | String to fully override "argo-workflows.fullname" template |
| images.pullPolicy | string | `"Always"` | imagePullPolicy to apply to all containers |
| images.pullSecrets | list | `[]` | Secrets with credentials to pull images from a private registry |
| kubeVersionOverride | string | `""` | Override the Kubernetes version, which is used to evaluate certain manifests |
| nameOverride | string | `nil` | String to partially override "argo-workflows.fullname" template |
| singleNamespace | bool | `false` | Restrict Argo to operate only in a single namespace (the namespace of the Helm release) by apply Roles and RoleBindings instead of the Cluster equivalents, and start workflow-controller with the --namespaced flag. Use it in clusters with strict access policy. |

### Workflow

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| workflow.namespace | string | `nil` | Deprecated; use controller.workflowNamespaces instead. |
| workflow.rbac.create | bool | `true` | Adds Role and RoleBinding for the above specified service account to be able to run workflows. A Role and Rolebinding pair is also created for each namespace in controller.workflowNamespaces (see below) |
| workflow.serviceAccount.annotations | object | `{}` | Annotations applied to created service account |
| workflow.serviceAccount.create | bool | `false` | Specifies whether a service account should be created |
| workflow.serviceAccount.name | string | `"argo-workflow"` | Service account which is used to run workflows |

### Workflow Controller

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| controller.affinity | object | `{}` | Assign custom [affinity] rules |
| controller.clusterWorkflowTemplates.enabled | bool | `true` | Create a ClusterRole and CRB for the controller to access ClusterWorkflowTemplates. |
| controller.containerRuntimeExecutor | string | `"docker"` | Specifies the container runtime interface to use (one of: `docker`, `kubelet`, `k8sapi`, `pns`, `emissary`) |
| controller.containerRuntimeExecutors | list | `[]` | Specifies the executor to use. This has precedence over `controller.containerRuntimeExecutor`. |
| controller.extraArgs | list | `[]` | Extra arguments to be added to the controller |
| controller.extraContainers | list | `[]` | Extra containers to be added to the controller deployment |
| controller.extraEnv | list | `[]` | Extra environment variables to provide to the controller container |
| controller.image.registry | string | `"quay.io"` | Registry to use for the controller |
| controller.image.repository | string | `"argoproj/workflow-controller"` | Registry to use for the controller |
| controller.image.tag | string | `""` | Overrides the image tag whose default is the chart appVersion. |
| controller.initialDelay | string | `nil` | Resolves ongoing, uncommon AWS EKS bug: https://github.com/argoproj/argo-workflows/pull/4224 |
| controller.instanceID.enabled | bool | `false` | Configures the controller to filter workflow submissions to only those which have a matching instanceID attribute. |
| controller.instanceID.explicitID | string | `""` | Use a custom instanceID |
| controller.instanceID.useReleaseName | bool | `false` | Use ReleaseName as instanceID |
| controller.links | list | `[]` | Configure Argo Server to show custom [links] |
| controller.livenessProbe | object | See [values.yaml] | Configure liveness [probe] for the controller |
| controller.loadBalancerSourceRanges | list | `[]` | Source ranges to allow access to service from. Only applies to service type `LoadBalancer` |
| controller.logging.globallevel | string | `"0"` | Set the glog logging level |
| controller.logging.level | string | `"info"` | Set the logging level (one of: `debug`, `info`, `warn`, `error`) |
| controller.metricsConfig.enabled | bool | `false` | Enables prometheus metrics server |
| controller.metricsConfig.path | string | `"/metrics"` | Path is the path where metrics are emitted. Must start with a "/". |
| controller.metricsConfig.port | int | `9090` | Port is the port where metrics are emitted |
| controller.metricsConfig.portName | string | `"metrics"` | Container metrics port name |
| controller.metricsConfig.servicePort | int | `8080` | Service metrics port |
| controller.metricsConfig.servicePortName | string | `"metrics"` | Service metrics port name |
| controller.name | string | `"workflow-controller"` | Workflow controller name string |
| controller.namespaceParallelism | string | `nil` | Limits the maximum number of incomplete workflows in a namespace |
| controller.nodeSelector | object | `{"kubernetes.io/os":"linux"}` | [Node selector] |
| controller.parallelism | string | `nil` | parallelism dictates how many workflows can be running at the same time |
| controller.pdb.enabled | bool | `false` | Configure [Pod Disruption Budget] for the controller pods |
| controller.persistence | object | `{}` | enable persistence using postgres |
| controller.podAnnotations | object | `{}` | podAnnotations is an optional map of annotations to be applied to the controller Pods |
| controller.podLabels | object | `{}` | Optional labels to add to the controller pods |
| controller.podSecurityContext | object | `{}` | SecurityContext to set on the controller pods |
| controller.podWorkers | string | `nil` | Number of pod workers |
| controller.priorityClassName | string | `""` | Leverage a PriorityClass to ensure your pods survive resource shortages. |
| controller.replicas | int | `1` | The number of controller pods to run |
| controller.resourceRateLimit | object | `{}` | Globally limits the rate at which pods are created. This is intended to mitigate flooding of the Kubernetes API server by workflows with a large amount of parallel nodes. |
| controller.resources | object | `{}` | Resource limits and requests for the controller |
| controller.securityContext | object | `{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]},"readOnlyRootFilesystem":true,"runAsNonRoot":true}` | the controller container's securityContext |
| controller.serviceAccount.annotations | object | `{}` | Annotations applied to created service account |
| controller.serviceAccount.create | bool | `true` | Create a service account for the controller |
| controller.serviceAccount.name | string | `""` | Service account name |
| controller.serviceAnnotations | object | `{}` | Annotations to be applied to the controller Service |
| controller.serviceLabels | object | `{}` | Optional labels to add to the controller Service |
| controller.serviceMonitor.additionalLabels | object | `{}` | Prometheus ServiceMonitor labels |
| controller.serviceMonitor.enabled | bool | `false` | Enable a prometheus ServiceMonitor |
| controller.serviceType | string | `"ClusterIP"` | Service type of the controller Service |
| controller.telemetryConfig.enabled | bool | `false` | Enables prometheus telemetry server |
| controller.telemetryConfig.path | string | `"/telemetry"` | telemetry path |
| controller.telemetryConfig.port | int | `8081` | telemetry container port |
| controller.telemetryConfig.servicePort | int | `8081` | telemetry service port |
| controller.telemetryConfig.servicePortName | string | `"telemetry"` | telemetry service port name |
| controller.tolerations | list | `[]` | [Tolerations] for use with node taints |
| controller.workflowDefaults | object | `{}` | Default values that will apply to all Workflows from this controller, unless overridden on the Workflow-level. Only valid for 2.7+ |
| controller.workflowNamespaces | list | `["default"]` | Specify all namespaces where this workflow controller instance will manage workflows. This controls where the service account and RBAC resources will be created. Only valid when singleNamespace is false. |
| controller.workflowRestrictions | object | `{}` | Restricts the Workflows that the controller will process. Only valid for 2.9+ |
| controller.workflowWorkers | string | `nil` | Number of workflow workers |

### Workflow Executor

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| executor.env | object | `{}` | Adds environment variables for the executor. |
| executor.image.registry | string | `"quay.io"` | Registry to use for the Workflow Executors |
| executor.image.repository | string | `"argoproj/argoexec"` | Repository to use for the Workflow Executors |
| executor.image.tag | string | `""` | Overrides the image tag whose default is the chart appVersion. |
| executor.resources | object | `{}` | Resource limits and requests for the Workflow Executors |
| executor.securityContext | object | `{}` | sets security context for the executor container |

### Workflow Server

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| server.affinity | object | `{}` | Assign custom [affinity] rules |
| server.baseHref | string | `"/"` | Value for base href in index.html. Used if the server is running behind reverse proxy under subpath different from /. |
| server.clusterWorkflowTemplates.enableEditing | bool | `true` | Give the server permissions to edit ClusterWorkflowTemplates. |
| server.clusterWorkflowTemplates.enabled | bool | `true` | Create a ClusterRole and CRB for the server to access ClusterWorkflowTemplates. |
| server.enabled | bool | `true` | Deploy the Argo Server |
| server.extraArgs | list | `[]` | Extra arguments to provide to the Argo server binary, such as for disabling authentication. |
| server.extraContainers | list | `[]` | Extra containers to be added to the server deployment |
| server.extraEnv | list | `[]` | Extra environment variables to provide to the argo-server container |
| server.image.registry | string | `"quay.io"` | Registry to use for the server |
| server.image.repository | string | `"argoproj/argocli"` | Repository to use for the server |
| server.image.tag | string | `""` | Overrides the image tag whose default is the chart appVersion. |
| server.ingress.annotations | object | `{}` | Additional ingress annotations |
| server.ingress.enabled | bool | `false` | Enable an ingress resource |
| server.ingress.extraPaths | list | `[]` | Additional ingress paths |
| server.ingress.hosts | list | `[]` | List of ingress hosts |
| server.ingress.ingressClassName | string | `""` | Defines which ingress controller will implement the resource |
| server.ingress.labels | object | `{}` | Additional ingress labels |
| server.ingress.pathType | string | `"Prefix"` | Ingress path type. One of `Exact`, `Prefix` or `ImplementationSpecific` |
| server.ingress.paths | list | `["/"]` | List of ingress paths |
| server.ingress.tls | list | `[]` | Ingress TLS configuration |
| server.loadBalancerIP | string | `""` | Static IP address to assign to loadBalancer service type `LoadBalancer` |
| server.loadBalancerSourceRanges | list | `[]` | Source ranges to allow access to service from. Only applies to service type `LoadBalancer` |
| server.name | string | `"server"` | Server name string |
| server.nodeSelector | object | `{"kubernetes.io/os":"linux"}` | [Node selector] |
| server.pdb.enabled | bool | `false` | Configure [Pod Disruption Budget] for the server pods |
| server.podAnnotations | object | `{}` | optional map of annotations to be applied to the ui Pods |
| server.podLabels | object | `{}` | Optional labels to add to the UI pods |
| server.podSecurityContext | object | `{}` | SecurityContext to set on the server pods |
| server.priorityClassName | string | `""` | Leverage a PriorityClass to ensure your pods survive resource shortages |
| server.replicas | int | `1` | The number of server pods to run |
| server.resources | object | `{}` | Resource limits and requests for the server |
| server.secure | bool | `false` | Run the argo server in "secure" mode. Configure this value instead of `--secure` in extraArgs. |
| server.securityContext | object | `{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]},"readOnlyRootFilesystem":false,"runAsNonRoot":true}` | Servers container-level security context |
| server.serviceAccount.annotations | object | `{}` | Annotations applied to created service account |
| server.serviceAccount.create | bool | `true` | Create a service account for the server |
| server.serviceAccount.name | string | `""` | Service account name |
| server.serviceAnnotations | object | `{}` | Annotations to be applied to the UI Service |
| server.serviceLabels | object | `{}` | Optional labels to add to the UI Service |
| server.serviceNodePort | string | `nil` | Service node port |
| server.servicePort | int | `2746` | Service port for server |
| server.servicePortName | string | `""` | Service port name |
| server.serviceType | string | `"ClusterIP"` | Service type for server pods |
| server.sso | object | `{}` | SSO configuration when SSO is specified as a server auth mode. |
| server.tolerations | list | `[]` | [Tolerations] for use with node taints |
| server.volumeMounts | list | `[]` | Additional volume mounts to the server main container. |
| server.volumes | list | `[]` | Additional volumes to the server pod. |

### Artifact Repository

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| artifactRepository.archiveLogs | bool | `false` | Archive the main container logs as an artifact |
| artifactRepository.gcs | object | `{}` (See [values.yaml]) | Store artifact in a GCS object store |
| artifactRepository.s3 | object | See [values.yaml] | Store artifact in a S3-compliant object store |
| useDefaultArtifactRepo | bool | `false` | Influences the creation of the ConfigMap for the workflow-controller itself. |
| useStaticCredentials | bool | `true` | Use static credentials for S3 (eg. when not using AWS IRSA) |

## Breaking changes from the deprecated `argo` chart

1. the `installCRD` value has been removed. CRDs are now only installed from the conventional crds/ directory
1. the CRDs were updated to `apiextensions.k8s.io/v1`
1. the container image registry/project/tag format was changed to be more in line with the more common

   ```yaml
   image:
     registry: quay.io
     repository: argoproj/argocli
     tag: v3.0.1
   ```

   this also makes it easier for automatic update tooling (eg. renovate bot) to detect and update images.

1. switched to quay.io as the default registry for all images
1. removed any included usage of Minio
1. aligned the configuration of serviceAccounts with the argo-cd chart, ie: what used to be `server.createServiceAccount` is now `server.serviceAccount.create`
1. moved the previously known as `telemetryServicePort` inside the `telemetryConfig` as `telemetryConfig.servicePort` - same for `metricsConfig`

[affinity]: https://kubernetes.io/docs/concepts/configuration/assign-pod-node/
[links]: https://argoproj.github.io/argo-workflows/links/
[Node selector]: https://kubernetes.io/docs/user-guide/node-selection/
[Pod Disruption Budget]: https://kubernetes.io/docs/tasks/run-application/configure-pdb/
[probe]: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#container-probes
[Tolerations]: https://kubernetes.io/docs/concepts/configuration/taint-and-toleration/
[values.yaml]: values.yaml
