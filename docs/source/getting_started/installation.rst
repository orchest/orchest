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
We only have one prerequisite:

* `Docker <https://docs.docker.com/get-docker/>`_

Make sure your `Docker Engine version <https://docs.docker.com/engine/install/>`_ is at least
``20.10.7``:

.. code-block:: sh

   # Get installed Docker Engine version
   docker version -f "{{ .Client.Version }}"

Windows
~~~~~~~
For Orchest to work on Windows, Docker has to be configured to use WSL 2 (`Docker Desktop WSL 2
backend <https://docs.docker.com/desktop/windows/wsl/>`_).

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
   ./orchest install

   # Start Orchest.
   ./orchest start

.. tip::
   🎉 Now that you have installed Orchest, be sure to check out the :ref:`quickstart tutorial
   <quickstart>`.

Additional language dependencies
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
By default, running ``./orchest install``, installs only the language dependencies for Python.
Other language dependencies can be installed as follows:

.. code-block:: bash

   # To install R dependencies.
   ./orchest install --lang=r

   # To install all languages: Python, R and Julia.
   ./orchest install --lang=all

.. tip::
   👉 Language dependencies can also be installed through the Orchest UI, simply select the
   corresponding base image when building a new :ref:`environment <environments>`.

Networking issues
~~~~~~~~~~~~~~~~~
Docker has some known `network interruption issues
<https://github.com/docker/for-linux/issues/914>`_ that impact the host network of the machine that
Orchest is running on. To sidestep the issue it is recommended to disable IPv6 networking.

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
You can install our provided GPU images for the programming language you want using either the UI
(recommended) or CLI. Using the CLI:

.. code-block:: bash

  # Install the image with GPU passthrough for Python.
  ./orchest install --lang=python --gpu

Linux (supported)
~~~~~~~~~~~~~~~~~
For GPU images the host on which Orchest is running is required to have a GPU driver that is
compatible with the CUDA version installed in the image.  Compatible version pairs can be found
`here
<https://docs.nvidia.com/deploy/cuda-compatibility/index.html#binary-compatibility__table-toolkit-driver>`_.

The GPU supported image ``orchest/base-kernel-py-gpu`` includes CUDA Toolkit 10.1. Which
requires the NVIDIA driver on the host to be ``>= 418.39``.

To find out which version of the NVIDIA driver you have installed on your host run ``nvidia-smi``.

``nvidia-smi`` is also available from within the GPU enabled image. Please note that when run from
within the container it reports the CUDA Toolkit version installed on the *host*. To find out the
CUDA Toolkit version installed in the container image run ``cat /usr/local/cuda/version.txt``.

Additionally, we require the ``nvidia-container`` package to make sure Docker is able to provide GPU
enabled containers. Installation of the nvidia-container is done using (`source
<https://github.com/NVIDIA/nvidia-container-runtime#installation>`_):

.. code-block:: sh

   # Make sure you have first configured the nvidia-container-runtime
   # repository: https://nvidia.github.io/nvidia-container-runtime/
   sudo apt install nvidia-container-runtime

.. seealso::

    `Docker GPU documentation <https://docs.docker.com/config/containers/resource_constraints/#gpu>`_
        Most up to date instructions on installing Docker with NVIDIA GPU passthrough support.

Windows WSL 2 (supported)
~~~~~~~~~~~~~~~~~~~~~~~~~
In order to use GPUs using WSL 2, Docker has to be installed directly within the WSL 2 environment
(this is different from our configuring Docker Desktop to use the WSL 2 backend).

If Docker is installed directly within the WSL 2 follow the `CUDA on WSL User Guide
<https://docs.nvidia.com/cuda/wsl-user-guide/index.html>`_ provided by NVIDIA.

.. warning::
   🚨 Orchest's default installation recommends installing Docker Desktop and configuring it to use
   the WSL 2 backend. Sadly, this does not yet support CUDA.

macOS (not supported)
~~~~~~~~~~~~~~~~~~~~~
Unfortunately, ``nvidia-docker`` does not support GPU enabled images on macOS (see `FAQ
<https://github.com/NVIDIA/nvidia-docker/wiki/Frequently-Asked-Questions#is-macos-supported>`_ on
``nvidia-docker``).

Build from source
-----------------
.. tip::
   👉 We recommend building a tagged commit indicating a stable release. Sadly, releases before
   ``v2021.05.0`` can not be build due to a dependency mismatch.

You can expect the build to finish in roughly 15 minutes.

.. code-block:: bash

   git clone https://github.com/orchest/orchest.git && cd orchest

   # Check out the version you would like to build.
   git checkout v2022.03.0

   # Create the Docker network on which all Orchest services will run.
   docker network create orchest

   # Build Orchest's Docker containers from source (in parallel).
   scripts/build_container.sh

   # Start Orchest. Note that it will pull additional containers that
   # Orchest depends on, such as `postgres`.
   ./orchest start
