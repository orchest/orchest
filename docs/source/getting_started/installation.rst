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
For windows please install Orchest within the WSL 2.

.. note::
   Make sure you don't clone `orchest` in the paths shared with Windows (`/mnt/C/...` etc.).
   Due to permission handling in WSL2 this is not supported. Use the native filesystem in for example
   the Linux user home directory (`~/orchest`).

.. caution::
   For all further steps make sure to run CLI commands inside a WSL terminal. You can do this by
   opening the distribution using the Start menu or by `setting up the Windows Terminal
   <https://docs.microsoft.com/en-us/windows/wsl/setup/environment#set-up-windows-terminal>`_.

.. _regular installation:

Install Orchest
---------------
.. code-block:: bash

   git clone https://github.com/orchest/orchest.git && cd orchest
   bash orchest install

.. tip::
   🎉 Now that you have installed Orchest, be sure to check out the :ref:`quickstart tutorial
   <quickstart>`.

Additional language dependencies
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
By default, running ``bash orchest install``, installs only the language dependencies for Python.
Other language dependencies can be installed as follows:

.. code-block:: bash

   # To install R dependencies.
   bash orchest install --lang=r

   # To install all languages: Python, R and Julia.
   bash orchest install --lang=all

.. tip::
   👉 Language dependencies can also be installed through the Orchest UI, simply select the
   corresponding base image when building a new :ref:`environment <environments>`.

Networking issues
~~~~~~~~~~~~~~~~~
Docker has some known `network interruption issues
<https://github.com/docker/for-linux/issues/914>`_ that impact the host network of the machine that
Orchest is running on. To sidestep the issue it is recommended to disable IPv6 networking.

.. note::
   This only applies if you're running `minikube` with Docker as the driver.

You can disable IPv6 using:

.. code-block:: bash

   echo "net.ipv6.conf.all.disable_ipv6=1\nnet.ipv6.conf.default.disable_ipv6=1\nnet.ipv6.conf.lo.disable_ipv6=1" | sudo tee -a /etc/sysctl.conf

Alternatively, you can disable IPv6 at the kernel level using a boot directive like
``ipv6.disable=1``.  `This article
<https://www.thegeekdiary.com/how-to-disable-ipv6-on-ubuntu-18-04-bionic-beaver-linux/>`_ describes
how to do that for Ubuntu Linux.

.. _installation gpu support:

GPU support
-----------
Currently GPU support is not yet available.


Build from source
-----------------
You can expect the build to finish in roughly 15 minutes.

.. code-block:: bash

   git clone https://github.com/orchest/orchest.git && cd orchest

   # Check out the version you would like to build.
   git checkout v2022.03.6

   # Activate `minikube`'s docker
   eval $(minikube -p minikube docker-env)

   # Build Orchest's container images from source (in parallel).
   scripts/build_container.sh -o "v2022.03.6" -t "v2022.03.6"

   # Install Orchest
   bash orchest install
