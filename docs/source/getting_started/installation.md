(installation)=

# Installation

```{eval-rst}
.. meta::
   :description: This page contains the installation instructions for Orchest.
```

This page contains the installation instructions for self-hosting the open source version of Orchest.

Alternatively, you can try out [our Cloud offering](https://cloud.orchest.io/signup)
which comes with a free, fully configured Orchest instance.

```{note}
Orchest is in beta.
```

## Prerequisites

To install Orchest you will need a running [Kubernetes (k8s) cluster](https://kubernetes.io/docs/setup/). Any cluster should work. You can either pick a managed
service by one of the certified [cloud platforms](https://kubernetes.io/docs/setup/production-environment/turnkey-solutions/) or create a cluster
locally. For single node deployments, we recommend using at (the very) least 2 CPU and 8GB of RAM.

Pick your deployment environment and Kubernetes distribution and follow the installation steps
below.

(regular-installation)=

## Installing Orchest

We recommend installing Orchest on a clean cluster to prevent clashes with existing cluster-level resources,
even though installing Orchest on an existing cluster is fully supported.
The supported operating systems are:

- Linux (`x86_64`)
- [Windows Subsystem for Linux 2](https://docs.microsoft.com/en-us/windows/wsl/about) (WSL2)
- macOS (M1 Macs should use [Rosetta](https://support.apple.com/en-us/HT211861) for emulation)

```{raw} html
:file: install_widget.html
```

## Starting Orchest

The installation procedures will leave Orchest up and running.
To manually start Orchest from the command line, run this command:

```bash
orchest start
```

## Special requirements

If you have **special requirements** (or preferences) for deploying Orchest on your Kubernetes
cluster, then one of the following subsections might be helpful:

- {ref}`Setting up an FQDN <install-fqdn>`: Reach Orchest using a Fully Qualified Domain Name
  (FQDN) instead of the cluster's IP directly.
- {ref}`Installing without Argo Workflows <install-argo>`: Don't let Orchest manage Argo in case you
  already have Argo Workflows installed on your Kubernetes cluster.
- {ref}`Installing using kubectl <install-kubectl>`: If you would rather use `kubectl` instead of
  the `orchest-cli`.
- {ref}`Setting up a reverse proxy <reverse-proxy>`: Useful when installing Orchest in remote machines,
  such as AWS EC2 instances.
- {ref}`Scarse (CPU) resources - tweak DNS settings <cpu-contention-dns>`: Increase DNS query
  timeout to prevent name resolution failing during time of CPU resource contention. Especially
  applicable for single node deployments close to the minimum requirement of 2 CPU.

(install-fqdn)=

### Setting up an FQDN

If you would rather reach Orchest using a Fully Qualified Domain Name (FQDN) instead of using the
cluster's IP directly, you can install Orchest using:

```bash
orchest install --fqdn="localorchest.io"
```

% or, if you have already installed Orchest but would like to set up an FQDN

Next, make Orchest reachable locally through the FQDN:

```bash
# Set up the default Fully Qualified Domain Name (FQDN) in your
# /etc/hosts so that you can reach Orchest locally.
echo "$(minikube ip)\tlocalorchest.io" >> /etc/hosts
```

(install-argo)=

### Installing Orchest without Argo Workflows

If you already have [Argo Workflows](https://argoproj.github.io/argo-workflows/) installed on your
Kubernetes cluster, then you need to explicitly tell Orchest not to install it again:

```bash
orchest install --no-argo
```

Since Argo Workflows creates cluster level resources, installing it again would lead to clashes or
both Argo Workflow deployments managing Custom Resource Objects (most likely you don't want either
of those things to happen).

Now that you are using an Argo Workflows set-up that is not managed by the Orchest Controller, you
need to make sure that the right set of permissions are configured for Orchest to work as expected.
Check out the permissions that the Orchest Controller sets for Argo [here](https://github.com/orchest/orchest/tree/v2022.06.5/services/orchest-controller/deploy/thirdparty/argo-workflows/templates).

(install-kubectl)=

### Installing Orchest using `kubectl`

The code snippet below will install Orchest in the `orchest` namespace. In case you want to
install in another namespace you can use tools like [yq](https://github.com/mikefarah/yq) to
change the specified namespace in `orchest-controller.yaml` and `example-orchestcluster.yaml`.

```bash
# Get the latest available Orchest version
export VERSION=$(curl \
   "https://update-info.orchest.io/api/orchest/update-info/v3?version=None&is_cloud=False" \
   | grep -oP "v\d+\.\d+\.\d+")

# Create the namespace to install Orchest in
kubectl create ns orchest

# Deploy the Orchest Operator
kubectl apply \
  -f "https://github.com/orchest/orchest/releases/download/${VERSION}/orchest-controller.yaml"

# Apply an OrchestCluster Custom Resource
kubectl apply \
  -f "https://github.com/orchest/orchest/releases/download/${VERSION}/example-orchestcluster.yaml"
```

In case you want to configure the Orchest Cluster, you can patch the created `OrchestCluster`.

(reverse-proxy)=

### Setting up a reverse proxy

When installing Orchest in remote machines, such as AWS EC2 instances,
you will need to set up a reverse proxy that redirects traffic to the application appropriately.
Here is an example on how to do it on an Ubuntu-based EC2 machine using [nginx]:

```bash
sudo apt-get install -y nginx

# Make Orchest accessible on the instance through localorchest.io
minikube ip | xargs printf "%s localorchest.io" | sudo tee -a  /etc/hosts

# Set up a reverse proxy that listens on port 80 of the host
# and routes traffic to Orchest
sudo cat << EOF > /etc/nginx/sites-available/localorchest.io
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
	listen 80 default_server;
	listen [::]:80 default_server;

	server_name orchest;

	location / {
		proxy_pass http://localorchest.io;

		# For project or file manager uploads.
		client_max_body_size 0;

		# WebSocket support.
		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection $connection_upgrade;
		proxy_read_timeout 86400;
	}
}
EOF

sudo ln -s /etc/nginx/sites-available/localorchest.io /etc/nginx/sites-enabled/
# Remove default_server.
sudo truncate -s 0 /etc/nginx/sites-available/default
sudo service nginx restart
```

[nginx]: https://nginx.org/en/

(cpu-contention-dns)=

### Scarse (CPU) resources - tweak DNS settings

This section applies mostly to single-node deployments (e.g. using minikube) as otherwise you can
configure your Kubernetes cluster to scale with respect to the current load.

During times of CPU resource contention, the [CoreDNS](https://coredns.io/) pod could start failing
its `readinessProbe` leading to `kube-proxy` updating `iptables` rules to stop routing traffic to
the pod ([k8s
docs](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#types-of-probe)), for which
it uses the `REJECT` target. This means that DNS queries will start failing immediately without the
configured resolver timeout being respected (in Orchest we use a timeout of `30` seconds with `2`
attempts). In order to respect the timeout instead of failing immediately, you can tweak the
`readinessProbe` or simply remove it by editing the manifest of the `coredns` deployment:

```sh
kubectl edit -n kube-system deploy coredns
```

```{note}
By editing the `coredns` deployment the corresponding pod(s) will get replaced, which can lead to
failing DNS queries during the replacement period.
```

```{warning}
Configuration changes of CoreDNS will be lost when executing `kubeadm upgrade apply` or, in case of
`minikube`, when stopping and starting your cluster (i.e. `minikube start`) -- see [Kubernetes
docs](https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-reconfigure/#applying-coredns-configuration-changes).
Thus you will have to reapply your changes whenever you run `kubeadm upgrade apply` or whenever you
restart your minikube cluster.

Why? Well, the [CoreDNS manifests are hardcoded in
`kubeadm`](https://github.com/kubernetes/kubernetes/blob/4daf5f903b3cb73365093e2f83c18d4d8e53c0c5/cmd/kubeadm/app/phases/addons/dns/manifests.go),
thus if `kubeadm init phase addon coredns` is ever invoked (which [minikube does on cluster
start](https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-reconfigure/#applying-coredns-configuration-changes)),
then your changes to the configuration of CoreDNS are lost.

What can I do about it? If you are really keen on not having to reapply your changes then you could
start minikube with a custom bootstrapper (i.e. `minikube start --bootstrapper=mycustomkubeadm`)
where the custom bootstrapper is basically a fork of `kubeadm` but with a different CoreDNS
configuration. Or, if you are not using minikube but using `kubeadm` directly, then you could skip
the `kubeadm` addon phase and deploy them yourself.
```

## Closing notes

Authentication is disabled by default after installation. Check out the {ref}`Orchest settings <settings>` to learn how to enable it.
