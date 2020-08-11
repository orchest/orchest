Installation
============

Orchest can be run locally on Windows, macOS and Linux.

Requirements
------------
- Docker (tested on 19.03.9)

The run scripts (orchest.sh/orchest.bat) will mount the Docker socket to the :code:`orchest-ctl`
container to manage the local Docker containers necessary for running Orchest. In addition, the
Docker socket is necessary for the dynamic spawning of containers that occurs when running individual
pipeline steps.


Installation steps
------------------

Linux, macOS, and Windows (WSL 2)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: bash

   git clone https://github.com/orchest/orchest.git
   cd orchest
   ./orchest.sh start


**Note!** on Windows Docker should be configured to use WSL 2. Make sure you clone inside the
Linux environment. More info about Docker + WSL 2 can be found here:
https://docs.docker.com/docker-for-windows/wsl/.