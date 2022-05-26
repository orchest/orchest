.. _installation:

Installation
============

.. note::
   Orchest is in beta.

We provide three installation paths, installation through:

* `kubectl <https://kubernetes.io/docs/tasks/tools/#kubectl>`_, or
* our Python based CLI `orchest-cli <https://pypi.org/project/orchest-cli/>`_, or
* `our Cloud offering <https://cloud.orchest.io/signup>`_ which comes with a free, fully configured
  Orchest instance.

Prerequisites
-------------

To use Orchest you will need a `Kubernetes (k8s) cluster <https://kubernetes.io/docs/setup/>`_. Any
cluster should work, you can either pick a managed service by one of the certified `cloud platforms
<https://kubernetes.io/docs/setup/production-environment/turnkey-solutions/>`_ or create a cluster
locally using `minikube
<https://kubernetes.io/docs/tutorials/kubernetes-basics/create-cluster/cluster-intro/>`_.

.. note::
   💡 We recommend to install Orchest on a clean cluster to prevent it clashing with existing
   cluster-level resources. Do make sure that, no matter the cluster you choose, the ingress
   controller is configured.

Setting up a ``minikube`` cluster
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
First, make sure you `install minikube <https://minikube.sigs.k8s.io/docs/start/>`_. Next, create
your cluster:

.. code-block:: bash

   # Create a minikube cluster.
   minikube start --cpus=4

   # Enable the ingress addon
   minikube addons enable ingress

.. _regular installation:

Install ``orchest`` via ``orchest-cli``
---------------------------------------

.. code-block:: bash

   pip install orchest-cli
   orchest install

Now the cluster can be reached on the IP returned by:

.. code-block:: bash

   minikube ip

.. tip::
   🎉 Now that you have installed Orchest, be sure to check out the :ref:`quickstart tutorial
   <quickstart>`.

Installing using an FQDN
~~~~~~~~~~~~~~~~~~~~~~~~
If you would rather reach Orchest using a Fully Qualified Domain Name (FQDN) instead of using the
cluster's IP directly, you can install Orchest using:

.. code-block:: bash

   orchest install --fqdn="localorchest.io"

.. or, if you have already installed Orchest but would like to set up an FQDN

Next, make Orchest reachable through your FQDN reachable from the browser:

.. code-block:: bash

   # Set up the default Fully Qualified Domain Name (FQDN) in your
   # /etc/hosts so that you can reach Orchest locally.
   echo "$(minikube ip)\tlocalorchest.io" >> /etc/hosts

Install ``orchest`` via ``kubectl``
-----------------------------------

.. tip::
   We recommend using the ``orchest-cli`` for installing and managing your Orchest Clusters.

The code snippet below will install Orchest in the ``orchest`` namespace. In case you want to
install in another namespace you can use tools like `yq <https://github.com/mikefarah/yq>`_ to
change the specified namespace in ``orchest-controller.yaml``.

.. code-block:: bash

   # Get the latest available Orchest version
   export VERSION=$(curl \
      "https://update-info.orchest.io/api/orchest/update-info/v3?version=None&is_cloud=False" \
      | grep -oP "v\d+\.\d+\.\d+")

   # Deploy the Orchest Operator
   kubectl apply \
     -f "https://github.com/orchest/orchest/releases/download/${VERSION}/orchest-controller.yaml"

   # Apply an OrchestCluster Custom Resource
   kubectl apply \
     -f "https://github.com/orchest/orchest/releases/download/${VERSION}/example-orchestcluster.yaml"

In case you want to configure the Orchest Cluster, you can patch the created ``OrchestCluster``.

Closing notes
-------------
Authentication is disabled by default after installation. Check out the :ref:`Orchest settings
<orchest settings>` to learn how to enable it.
