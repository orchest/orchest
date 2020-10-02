Contributer guides
==================

Contributor License Agreement
-----------------------------

Our CLA is almost an exact copy of the Apache CLA (apart from the names), which the cla-assistant
will automatically prompt you to sign upon a pull request. Signing is done electronically.

The CLA ensures that Orchest has clear ownership specification for all contributions, which in
turns lets us guarantee to users that we have no "stray" intellectual property or
differently-licensed material.


Development environment
-----------------------
To start hacking on Orchest you simply have to clone the repo from GitHub. Useful scripts are
included in the root-level :code:`scripts/` directory, such as :code:`build_container.sh` and 
:code:`run_tests.sh`.

.. code-block:: bash

   git clone https://github.com/orchest/orchest.git
   cd orchest

   # Start Orchest in dev mode which mounts the repo code to the correct
   # paths in the Docker containers to not require any rebuilds. In 
   # addition, servers build on Flask are started in development mode.
   ./orchest.sh start dev


Feel free to pick up any of the issues on `GitHub <https://github.com/orchest/orchest/issues>`_ or
create a custom pull request 💪
