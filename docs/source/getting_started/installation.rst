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
* `helm <https://helm.sh/docs/intro/install/>`_
* `kubectl <https://kubernetes.io/docs/tasks/tools/#kubectl>`_
* make
* bash

Windows
~~~~~~~
.. caution::
   For all further steps, including installation of the prerequisites, make sure to run CLI commands
   inside a WSL terminal. You can do this by opening the distribution using the Start menu or by
   `setting up the Windows Terminal
   <https://docs.microsoft.com/en-us/windows/wsl/setup/environment#set-up-windows-terminal>`_.

For windows please install Orchest within the WSL 2.

Make sure you don't clone the Orchest repository in the paths shared with Windows (e.g.
``/mnt/C/...``). Due to permission handling in WSL2 this is not supported. Use the native filesystem
instead, for example clone orchest in the Linux user home directory:

.. code-block:: bash

   cd && git clone https://github.com/orchest/orchest.git

.. _regular installation:

Install Orchest
---------------
.. code-block:: bash

   git clone https://github.com/orchest/orchest.git && cd orchest

   # Start a minikube cluster with profile "minikube".
   minikube start --cpus=4

   bash orchest install

   # Set up the default Fully Qualified Domain Name (FQDN) in your
   # /etc/hosts so that you can reach Orchest locally.
   echo "$(minikube ip)\tlocalorchest.io" >> /etc/hosts

.. tip::
   🎉 Now that you have installed Orchest, be sure to check out the :ref:`quickstart tutorial
   <quickstart>`.

.. _installation gpu support:

GPU support
-----------
Currently GPU support is not yet available. Coming soon!


Build from source
-----------------
You can expect the build to finish in roughly 15 minutes.

.. code-block:: bash

   git clone https://github.com/orchest/orchest.git && cd orchest

   # Check out the version you would like to build.
   git checkout v2022.03.8

   # Activate `minikube`'s docker
   eval $(minikube -p minikube docker-env)

   # Build Orchest's container images from source (in parallel).
   scripts/build_container.sh -o "v2022.03.8" -t "v2022.03.8"

   # Install Orchest
   bash orchest install
