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
locally. Do note that only the following container runtimes are supported:

- [containerd](https://containerd.io/)
- [Docker](https://www.docker.com/products/container-runtime/)

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
- {ref}`Installing without Nginx Ingress Controller <install-nginx>`: Don't let Orchest manage
  nginx ingress controller if you already have it installed on your Kubernetes cluster.
- {ref}`Installing using kubectl <install-kubectl>`: If you would rather use `kubectl` instead of
  the `orchest-cli`.
- {ref}`Setting up a reverse proxy <reverse-proxy>`: Useful when installing Orchest in remote machines,
  such as AWS EC2 instances.

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

(install-nginx)=

### Installing Orchest without Nginx Ingress Controller

If you already have [nginx ingress controller](https://kubernetes.github.io/ingress-nginx/deploy) deployed on your
Kubernetes cluster, then you need to tell Orchest not to install it again:

```bash
orchest install --no-nginx
```

```{note}
Installation of the `Nginx Ingress Controller` requires different procedures on [EKS](https://kubernetes.github.io/ingress-nginx/deploy/#aws)
and [GKE](https://kubernetes.github.io/ingress-nginx/deploy/#gce-gke) clusters.
```

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

## Closing notes

Authentication is disabled by default after installation. Check out the {ref}`Orchest settings <settings>` to learn how to enable it.
