.. _development workflow:

Development workflow
====================

Prerequisites
-------------

* Docker: https://docs.docker.com/get-docker/
* pre-commit: https://pre-commit.com/#installation

Building
--------
Since Orchest is a fully containerized application you will first have to build the containers.

.. code-block:: bash

   # Ensure you've installed orchest
   ./orchest install

   # It is also possible to specify certain flags, running it without
   # any will build all containers in parallel. Due to Docker's
   # layering system this should be rather quick.
   scripts/build_container.sh

Incremental development
-----------------------
Make sure Orchest is already installed first. See the :ref:`regular installation process <regular installation>` for more details.

Orchest supports incremental development by starting Orchest with the ``--dev`` flag. This allows you to
make code changes that are instantly reflected, without having to build the containers again.

.. note::
   For incremental development to work in WSL2, Docker must be installed within the WSL2
   environment itself.

.. code-block:: bash

   # Before Orchest can be run in "dev" mode the front-end code has to
   # be compiled
   # (for the first time you may need to add the `--install` flag)

   # First time setup
   npm run setup
   pnpm i

   # Run the Vite dev server to for hot reloading. Note: This command
   # does not finish.
   pnpm run dev

   # Run this command in a different terminal window.
   ./orchest start --dev

.. note::
   The ``--dev`` flag affects the following services: ``orchest-webserver``, ``auth-server``,
   ``file-manager`` and ``orchest-api``. For changes to other services you will have to run the
   build script again to rebuild the container (``scripts/build_container.sh -i <service-name>``)
   and restart Orchest (``./orchest restart --dev``) to make sure the newly built container is
   used.

With ``--dev`` the repository code from the filesystem is mounted (and thus adhering to git
branches) to the appropriate paths in the Docker containers. This allows for active code changes
being reflected inside the application. With ``--dev`` the Flask applications are run in
development mode.

.. tip::
   If the development mode hangs it's likely that Vite has left a daemon running that is stuck (the
   giveaway is that a Vite start runs on ports other than ``3000/3001``). To fix the issue, run
   ``killall node`` and restart Vite.

Updating the docs
-----------------

Our docs are handled by `Read the Docs
<https://docs.readthedocs.io/>`_ with Sphinx.

Content can be written in `.md` or `.rst` – whatever you feel meets the specific
needs of your content.

To update, run:

.. code-block:: bash

   cd docs

   # First time setup
   python3 -m pip install -r requirements.txt

   # Build
   make html

.. _before committing:

Before committing
-----------------

Install all development dependencies using:

.. code-block:: bash

   # if not run in prior development step
   npm run setup
   pnpm i

   pre-commit install

Run formatters, linters and tests with:

.. code-block:: bash

    pre-commit run
    scripts/run_tests.sh
