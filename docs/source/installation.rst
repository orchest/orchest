Installation
============

Orchest can be run locally on Linux, macOS and Windows (using the exact same steps!).

Requirements
------------
* Docker (tested on 19.03.9)

The run scripts :code:`orchest.sh` will mount the Docker socket to the :code:`orchest-ctl`
container to manage the local Docker containers necessary for running Orchest. In addition, the
Docker socket is necessary for the dynamic spawning of containers that occurs when running individual
pipeline steps.


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


.. note::

    On Windows, Docker should be configured to use WSL 2. Make sure you clone Orchest inside the
    Linux environment. More info about Docker + WSL 2 can be found here:
    https://docs.docker.com/docker-for-windows/wsl/.
