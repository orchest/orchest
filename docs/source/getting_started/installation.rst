.. _installation:

Installation
============

.. note::
   Orchest is in beta.

.. tip::
   👉 Get a fully configured Orchest instance out of the box on our `Orchest Cloud
   <https://cloud.orchest.io/signup>`_, for free!

Prerequisites
-------------

* `kubectl <https://kubernetes.io/docs/tasks/tools/#kubectl>`_
* `git <https://git-scm.com/book/en/v2/Getting-Started-Installing-Git>`_
* `pip <https://pip.pypa.io/en/stable/installation/>`_

Kubernetes cluster
~~~~~~~~~~~~~~~~~~
You need `a Kubernetes (k8s) cluster <https://kubernetes.io/docs/setup/>`_ to run Orchest:
you can either pick a managed service by `one of their certified cloud
platforms <https://kubernetes.io/docs/setup/production-environment/turnkey-solutions/>`_,
or `create one locally using
minikube <https://kubernetes.io/docs/tutorials/kubernetes-basics/create-cluster/cluster-intro/>`_:

.. code-block:: bash

   # Start a minikube cluster with profile "minikube".
   minikube start --cpus=4

   # Enable ingress addon
   minikube addons enable ingress

.. _regular installation:

.. include:: ../fragments/regular-installation.rst

Now the cluster can be reached the IP returned by:

.. code-block:: bash

   minikube ip

.. note::
   We recommend to install Orchest on a clean cluster (a non-existing cluster) because it is 
   hard to play well with other software already installed on the cluster, e.g, argo, etc.

.. note::
   Authentication is disabled in default installation.

.. tip::
   🎉 Now that you have installed Orchest, be sure to check out the :ref:`quickstart tutorial
   <quickstart>`.

Installing using an FQDN
------------------------
If you would rather reach Orchest using a Fully Qualified Domain Name (FQDN) instead of using the
cluster IP directly, you can install Orchest using:

.. code-block:: bash

   orchest install --fqdn="localorchest.io"

   # Set up the default Fully Qualified Domain Name (FQDN) in your
   # /etc/hosts so that you can reach Orchest locally.
   echo "$(minikube ip)\tlocalorchest.io" >> /etc/hosts

.. _installation gpu support:

GPU support
-----------
Currently GPU support is not yet available. Coming soon!