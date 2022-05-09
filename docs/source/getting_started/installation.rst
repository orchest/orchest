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

* `minikube <https://minikube.sigs.k8s.io/docs/start/>`_
* `kubectl <https://kubernetes.io/docs/tasks/tools/#kubectl>`_
* bash

Windows specific instructions can be found below `Windows`_.

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

.. note::
   In order to be able to access ``orchest`` nginx ingress controller has to be deployed, in minikube cluster
   it can be done by running ``minikube addons enable ingress``.
   
.. _regular installation:

Deploy ``orchest-controller``
-----------------------------

The ``orchest-controller`` is required to install and manage ``orchest``

.. code-block:: bash

   git clone https://github.com/orchest/orchest.git && cd orchest

   # Create the orchest namespace, as the Orchest Controller and Cluster will be deployed in
   # orchest namespace
   kubectl create ns orchest

   # Deploy orchest-controller
   kubectl apply -f services/orchest-controller/deploy-controller

Install ``orchest-cli``
-----------------------

.. code-block:: bash

   # Install orchest-cli via pip
   pip install orchest-cli


Install ``orchest`` via ``orchest-cli``
----------------------------------------

.. code-block:: bash

   # Install orchest
   orchest install


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


Windows
~~~~~~~
.. caution::
   For all further steps, including installation of the prerequisites, make sure to run CLI commands
   inside a WSL terminal. You can do this by opening the distribution using the Start menu or by
   `setting up the Windows Terminal
   <https://docs.microsoft.com/en-us/windows/wsl/setup/environment#set-up-windows-terminal>`_.

   Only WSL 2 is supported.

Make sure you don't clone the Orchest repository in the paths shared with Windows (e.g.
``/mnt/C/...``). Due to permission handling in WSL2 this is not supported. Use the native filesystem
instead, for example clone orchest in the Linux user home directory:

.. code-block:: bash

   cd && git clone https://github.com/orchest/orchest.git
