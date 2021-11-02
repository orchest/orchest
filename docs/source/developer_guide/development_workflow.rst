.. _development workflow:

Development workflow
====================

.. _prerequisites:

Prerequisites
-------------
In order to code on Orchest, you need to have the following installed on your system:

* `Docker <https://docs.docker.com/get-docker/>`_
* `pre-commit <https://pre-commit.com/#installation>`_
* `npm <https://docs.npmjs.com/downloading-and-installing-node-js-and-npm>`_ and `pnpm
  <https://pnpm.io/installation#using-npm>`_
* Python version ``3.x``

Next, you will need to setup your development environment:

.. code-block:: bash

   # Make sure you are inside the orchest root directory.
   npm run setup --install && \
       pnpm i && \
       python3 -m pip install -r docs/requirements.txt && \
       pre-commit install

Last but not least, Orchest needs to be build from source:

.. code-block:: bash

   scripts/build_container.sh

.. note::
   🎉 Awesome! Everything is set up now and you are ready to start coding. Have a look at our
   `GitHub <https://github.com/orchest/orchest/issues>`_ and find interesting issues to work on.

Incremental development
-----------------------
.. note::
   For incremental development to work in WSL2, Docker must be installed within the WSL2
   environment itself.

Now that you have Orchest and all dev dependencies installed it is ready to start Orchest in dev
mode by using the ``--dev`` flag. This way code changes that are instantly reflected, without having
to build the containers again.

.. code-block:: bash

   # In case any new dependencies were changed or added they need to
   # be installed.
   pnpm i

   # Run the client dev server for hot reloading. Note: This command
   # does not finish.
   pnpm run dev

   # Start Orchest in a new terminal window.
   ./orchest start --dev

With ``--dev`` the repository code from the filesystem is mounted (and thus adhering to git
branches) to the appropriate paths in the Docker containers. This allows for active code changes
being reflected inside the application.

A few additional notes about running Orchest with the ``--dev`` flag:

* All Flask applications are run in development mode.
* Only the ``orchest-webserver``, ``auth-server``, ``file-manager`` and ``orchest-api`` support code
  changes to be instantly reflected. For code changes to other services you will have to rebuild the
  container and restart Orchest.

Building the docs
-----------------

Our docs are build using `Read the Docs <https://docs.readthedocs.io/>`_ with Sphinx and written in
`reStructuredText`.

To build the docs, run:

.. code-block:: bash

   cd docs
   make html

Best practices
--------------

When adding new code to the repository, try to stick to the following best practices (WIP):

* New endpoints, e.g. in the ``orchest-api`` or proxy in the ``orchest-webserver``, should **NOT**
  end with trailing slashes. For example, go with ``/api/jobs`` (good) over ``/api/jobs/`` (bad).

.. _before committing:

Before committing
-----------------

Make sure your development environment is set up correctly (see :ref:`prerequisites
<prerequisites>`) so that pre-commit can take care of running the appropriate formatters and
linters. Lastly, it is good practice to run the units tests to make sure your changes didn't break
anything:

.. code-block:: bash

    scripts/run_tests.sh

In our CI we also run all of these checks together with integration tests to make sure the codebase
remains stable. To read more about testing, check out the :ref:`testing <testing>` section.

Troubleshooting & gotchas
-------------------------

Breaking schema changes
~~~~~~~~~~~~~~~~~~~~~~~

**What it looks like**: the client can't be accessed (the webserver is not up) or
the client can be accessed but a lot of functionality seems to not be working, e.g.
creating an environment.

**How to solve**:

.. code-block:: bash

   # Remove the database by cleaning the entire userdir.
   scripts/clean_userdir.sh

   # To restart Orchest and clean the database.
   ./orchest stop && scripts/clean_userdir.sh && ./orchest start --dev


**Context**: Some branches might contain a schema migration that applies changes to the
database in a way that is not compatible with ``dev`` or any other branch. By moving back
to those branches, the database has a schema that is not compatible with what's in the code.

**Verify**: Check the webserver and the api logs by using ``docker logs orchest-webserver``
or ``docker logs orchest-api``. It will be easy to spot because the service won't produce
other logs but the ones related to incompatible schema changes.

.. note::

   This approach will wipe your entire ``userdir``, meaning that you will lose all Orchest state. An
   alternative is to just remove the database directory ``userdir/.orchest/database``.
