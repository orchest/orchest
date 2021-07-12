Installation
============

Orchest can be run on Linux, macOS and Windows (using the exact same steps!).

Prerequisites
-------------
* Docker (`Engine version <https://docs.docker.com/engine/install/>`_ of ``>= 20.10.7``; run ``docker version`` to check.)

If you do not yet have Docker installed, please visit https://docs.docker.com/get-docker/.

.. note::
   On Windows, Docker has to be configured to use WSL 2. Make sure to clone Orchest inside the
   Linux environment. For more info and installation steps for Docker with WSL 2 backend, please
   visit https://docs.docker.com/docker-for-windows/wsl/.

.. _regular installation:

Linux, macOS and Windows
------------------------
Simply follow the steps below to install Orchest.

.. code-block:: bash

   git clone https://github.com/orchest/orchest.git && cd orchest
   ./orchest install

   # Verify the installation.
   ./orchest --help

   # Start Orchest.
   ./orchest start

Now that you have installed Orchest, get started with the :ref:`quickstart <quickstart>` tutorial.

.. note::
   For Linux/WSL 2 users, please take the following into account regarding the Docker
   networking configuration.

   Docker has `some network interruption issues <https://github.com/docker/for-linux/issues/914>`_,
   if you're connecting to Orchest from the same machine on which you're running it
   (e.g. using ``localhost``) it's recommended to disable IPv6 networking.

   It's recommended to disable IPv6 at the kernel level using a boot directive like ``ipv6.disable=1``.
   `This article <https://www.thegeekdiary.com/how-to-disable-ipv6-on-ubuntu-18-04-bionic-beaver-linux/>`_
   describes how to do that for Ubuntu Linux.

.. note::
   By default, running ``./orchest install``, installs only the language dependencies for Python.
   Other language dependencies can be installed as follows:

   .. code-block:: bash

      # To install R dependencies.
      ./orchest install --lang=r

      # To install all languages: Python, R and Julia.
      ./orchest install --lang=all

      # Check out all available options.
      ./orchest install --help

.. tip::
   Add Orchest to your ``PATH`` to gain the ability to invoke the ``orchest`` script from anywhere,
   e.g.  from your home directory: ``orchest status``. Depending on your shell add ``export
   PATH="$HOME/<orchest-install-directory-path>:$PATH"`` to the corresponding ``.profile`` file. You
   need to logout and login again for the changes to take effect.

Build from source
-----------------
You can expect the build to finish in roughly 15 minutes.

.. code-block:: bash

   git clone https://github.com/orchest/orchest.git && cd orchest

   # Check out the version you would like to build.
   git checkout v2021.05.0

   # Build all Docker containers from source (in parallel).
   scripts/build_container.sh

   # Verify the installation.
   ./orchest --help

.. tip::

    We recommend building a tagged commit indicating a stable release. Sadly, releases before
    ``v2021.05.0`` can not be build due to a dependency mismatch.

GPU support
-----------

.. note::
   Make sure you have installed our GPU images for the programming language you want to use. For
   example:

   .. code-block:: bash

      # Install the image with GPU passthrough for Python.
      ./orchest install --lang=python --gpu

**Linux** (supported)

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
enabled containers. Installation of the nvidia-container is done using ``apt install
nvidia-container-runtime``.

.. seealso::

    `Docker GPU documentation <https://docs.docker.com/config/containers/resource_constraints/#gpu>`_
        Most up to date instructions on installing Docker with NVIDIA GPU passthrough support.

**Windows WSL 2** (supported)

For WSL 2 follow the `CUDA on WSL User Guide
<https://docs.nvidia.com/cuda/wsl-user-guide/index.html>`_ provided by NVIDIA.

Please note that the "Docker Desktop WSL 2 backend" (meaning, you've installed Docker not
directly in the WSL 2 environment but on the Windows host itself) does not
support CUDA yet.

**macOS** (not supported)

Unfortunately, ``nvidia-docker`` does not support GPU enabled images on macOS (see `FAQ
<https://github.com/NVIDIA/nvidia-docker/wiki/Frequently-Asked-Questions#is-macos-supported>`_ on
``nvidia-docker``).

.. _cloud installation:

Run Orchest on the cloud
------------------------
Running Orchest on a cloud hosted VM (such as EC2) does not require a special installation. Simply
follow the :ref:`regular installation process <regular installation>`.

To enable SSL you first need to get the SSL certificates for your domain and put the certificates in
the correct place so that Orchest recognizes them. Luckily, this can all be done using:
``scripts/letsencrypt-nginx.sh <domain> <email>``. For the changes to take effect you need to
start Orchest on port ``80`` (as otherwise the default port ``8000`` is used):

.. code-block:: bash

   ./orchest start --port=80

.. tip::
   Refer to the :ref:`authentication section <authentication>` to enable the authentication server,
   giving you a login screen requiring a username and password before you can access Orchest.
