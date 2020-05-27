Installation
============

Orchest can be run locally on Windows, macOS and Linux.


Docker access
-------------

The run scripts (orchest.sh/orchest.bat) will mount the Docker socket to the :code:`orchest-ctl`
container to manage the local Docker containers necessary for running Orchest. In addition, the
Docker socket is necessary for the dynamic spawning of containers that occurs when running individual
pipeline steps.

Requirements
------------
- Docker (tested on 19.03.9)

Installation steps
------------------

Linux/macOS

.. code-block:: bash

   git clone https://github.com/orchest/orchest.git
   cd orchest
   ./orchest.sh start

Windows

.. code-block:: bash

   git clone https://github.com/orchest/orchest.git
   cd orchest
   orchest start

**Note!** On Windows, make sure to give Docker permission to mount the directory in which
you cloned Orchest. For more details check the `Windows Docker documentation <https://docs.docker.com/docker-for-windows/#file-sharing>`_.
