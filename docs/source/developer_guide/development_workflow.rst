Development workflow
====================

Install all development dependencies using:

.. code-block:: bash

   # https://pre-commit.com/
   pre-commit install

To start hacking on Orchest you simply have to clone the repo from GitHub and start Orchest in
``dev`` mode:

.. code-block:: bash

   git clone https://github.com/orchest/orchest.git
   cd orchest

   # Before Orchest can be run in "dev" mode the front-end code has to
   # be compiled.
   scripts/dev_compile_frontend.sh

   # Start Orchest in dev mode which mounts the repo code to the correct
   # paths in the Docker containers to not require any rebuilds. In 
   # addition, servers build on Flask are started in development mode.
   ./orchest start dev

``dev`` mode mounts the repository code from the filesystem (and thus adhering to branches) to the
appropriate paths in the Docker containers. This allows for active code changes being reflected
inside the application. In ``dev`` mode the Flask applications are run in development mode. The
following services support ``dev`` mode (others would have to be rebuild to show code changes):
``orchest-webserver``, ``auth-server``, ``file-manager`` and ``orchest-api``.

Additional useful scripts are included in the root-level ``scripts/`` directory, such as
``build_container.sh`` and ``run_tests.sh``.

Before submitting pull requests, run lints and tests with:

.. code-block:: bash

    pre-commit run -a
    scripts/run_tests.sh
