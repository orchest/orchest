Installation
============

Orchest can be run locally on Linux, macOS and Windows (using the exact same steps!).

Requirements
------------
* Docker (tested on 19.03.9)

If you do not yet have Docker installed, please visit https://docs.docker.com/get-docker/.

Linux, macOS and Windows
-------------------------
Simply follow the steps below to install Orchest. For Windows, please read the note at the bottom
first.

.. code-block:: bash

   # Clone the repository and change directory.
   git clone https://github.com/orchest/orchest.git
   cd orchest

   # The start command will automatically install Orchest if it is not 
   # yet installed. After installation is finished Orchest is started.
   ./orchest.sh start

The run script ``orchest.sh`` will mount the Docker socket to the ``orchest-ctl``
container to manage the local Docker containers necessary for running Orchest. In addition, the
Docker socket is necessary for the dynamic spawning of containers that occurs when running individual
pipeline steps.

.. note::

    On Windows, Docker has to be configured to use WSL 2. Make sure to clone Orchest inside the
    Linux environment. For more info about Docker with WSL 2, please visit
    https://docs.docker.com/docker-for-windows/wsl/.

GPU enabled images
-------------------------

**Linux**

The host running Orchest needs to have a GPU driver  that is compatible with
the version of CUDA running in the container.
Valid pairs can be found `here <https://docs.nvidia.com/deploy/cuda-compatibility/index.html#binary-compatibility__table-toolkit-driver>`_.

You will also need to install the ndivia-container package (`apt-get install nvidia-container-runtime`) to
make sure docker is able to provide GPU enabled containers.
See `this <https://docs.docker.com/config/containers/resource_constraints/#gpu>`_ for the latest GPU enabled container setup.


**macOS**

We currently do not support GPU enabled images on macOS, given that macOS is not supported
by nvidia-docker. See the nvidia-docker `FAQ <https://github.com/NVIDIA/nvidia-docker/wiki/Frequently-Asked-Questions#is-macos-supported>`_.

**Windows WSL2**

GPU enabled images are supported. You will need to follow the official user `guide <https://docs.nvidia.com/cuda/wsl-user-guide/index.html>`_
provided by nvidia. As per the guide, "Note that NVIDIA Container Toolkit does not yet support Docker Desktop WSL 2 backend.",
so Orchest does not support GPU enabled images for Docker Desktop WSL2.
