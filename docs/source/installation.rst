Installation
============

Orchest can be run locally on Windows, macOS and Linux.


Docker access
-------------

The run scripts (orchest.sh/orchest.bat) will mount the Docker socket to the :code:`orchest-ctl`
container to manage the local Docker container necessary for running Orchest. In addition, the
Docker socket is necessary for dynamic spawning of containers that occurs when running individual
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

