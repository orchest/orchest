Installation
============

Orchest can be run on Linux, macOS and Windows (using the exact same steps!).

Prerequisites
-------------
* Docker

If you do not yet have Docker installed, please visit https://docs.docker.com/get-docker/.

.. _regular installation:

Linux, macOS and Windows
-------------------------
Simply follow the steps below to install Orchest. For Windows, please read the note at the bottom
first.

.. code-block:: bash

   # Clone the repository and change directory.
   git clone https://github.com/orchest/orchest.git
   cd orchest

   # The update command is used both for installation and updating to
   # the newest release.
   ./orchest update

   # Verify the installation. This should print the help message.
   ./orchest

.. note::

    On Windows, Docker has to be configured to use WSL 2. Make sure to clone Orchest inside the
    Linux environment. For more info and installation steps for Docker with WSL 2 backend, please
    visit https://docs.docker.com/docker-for-windows/wsl/.

Build from source
-----------------
You should expect the build to finish in roughly 25 minutes.

.. code-block:: bash

   # Clone the repository and change directory.
   git clone https://github.com/orchest/orchest.git
   cd orchest

   # Check out the version you would like to build.
   git checkout v0.2.1

   # Build all Docker containers from source (in parallel).
   scripts/build_container.sh

   # Verify the installation. This should print the help message.
   ./orchest

.. warning::

    We recommend building a tagged commit indicating a release. Other commits cannot be considered
    stable.

GPU support
-----------

**Linux** (supported)

.. TODO We need to give the user an overview of the CUDO version inside our base images. Otherwise
   they will have to found out themselves. Additionally, we should provide the commands to find out
   their driver version.

For GPU images the host on which Orchest is running is required to have a GPU driver that is
compatible with the CUDA version installed in the image.
Compatible version paris can be found `here
<https://docs.nvidia.com/deploy/cuda-compatibility/index.html#binary-compatibility__table-toolkit-driver>`_.

Additionally, we require the nvidia-container package to make sure docker is able to provide GPU
enabled containers. Installation of the nvidia-container is done using ``apt-get install
nvidia-container-runtime``. 

Please refer to the `Docker documentation
<https://docs.docker.com/config/containers/resource_constraints/#gpu>`_ for the most up to date GPU
enabled container setup.


**macOS** (not supported)

Sadly, nvidia-docker does not support GPU enables images (see `FAQ
<https://github.com/NVIDIA/nvidia-docker/wiki/Frequently-Asked-Questions#is-macos-supported>`_ on
nvidia-docker).

**Windows WSL 2** (not yet supported)

For WSL follow the `CUDA on WSL User Guide
<https://docs.nvidia.com/cuda/wsl-user-guide/index.html>`_ provided by nvidia. 

For WSL 2 however, the user guide states: "Note that NVIDIA Container Toolkit does not yet support
Docker Desktop WSL 2 backend." 

Run Orchest on the cloud
------------------------
Running Orchest on the cloud does not require a special installation. Simply follow the
:ref:`regular installation process <regular installation>`.

To enable SSL run ``scripts/letsencrypt-nginx.sh`` and restart Orchest ``./orchest restart``.

Please refer to the :ref:`authentication section <authentication>` to enable the authentication
server, giving you a login screen requiring a username and password before you can access Orchest.
