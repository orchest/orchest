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
