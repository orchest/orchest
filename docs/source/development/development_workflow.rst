.. _development workflow:

Development workflow
====================

.. _development prerequisites:

Prerequisites
-------------
In order to code on Orchest, you need to have the following installed on your system:

* Python version ``3.x``
* `Docker <https://docs.docker.com/get-docker/>`_
* `pre-commit <https://pre-commit.com/#installation>`_
* `npm <https://docs.npmjs.com/downloading-and-installing-node-js-and-npm>`_ and `pnpm
  <https://pnpm.io/installation#using-npm>`_
* `virtualenv <https://virtualenv.pypa.io/en/latest/installation.html>`_
* `Google Chrome <https://www.google.com/chrome/>`_ (used for integration tests only!)

Next, you will need to setup your development environment.

Development environment
-----------------------
Run the code below to install all dependencies needed for :ref:`incremental development <incremental
development>`, :ref:`building the docs <building the docs>`, :ref:`running tests <tests>` and
automatically running pre-commit hooks:

.. code-block:: bash

   # Make sure you are inside the orchest root directory.
   npm run setup --install && \
       pnpm i && \
       # Install dependencies to build the docs
       python3 -m pip install -r docs/requirements.txt && \
       # Install pre-commit hooks
       pre-commit install && \
       # Dependencies to run unit tests
       sudo apt-get install -y default-libmysqlclient-dev

IDE & language servers
~~~~~~~~~~~~~~~~~~~~~~
.. note::
   👉 This section is for VS Code and `pyright <https://github.com/microsoft/pyright>`_ users.

Who doesn't like to use the smarts of their IDE by using features such as auto complete, go to
definition, find all references etc. For everyone who is using VS Code (or the `pyright
<https://github.com/microsoft/pyright>`_ language server to be more precise) the different services
contain their own ``pyrightconfig.json`` file that configures these features. All that is needed is
to install the dependencies of the services in the correct virtual environment. This is done using:

.. code-block:: bash

   scripts/run_tests.sh

Next you can create a workspace file that sets up VS Code to use the right Python interpreters (do
note that this won't include all the files defined in the Orchest repo), e.g.:

.. code-block:: json

    {
        "folders": [
            {
                "path": "services/orchest-api"
            },
            {
                "path": "services/orchest-webserver"
            },
            {
                "path": "services/base-images/runnable-shared"
            },
            {
                "path": "services/orchest-ctl"
            },
            {
                "path": "services/session-sidecar"
            },
            {
                "path": "services/memory-server"
            },
            {
                "name": "orchest-sdk",
                "path": "orchest-sdk/python"
            },
            {
                "name": "internal lib Python",
                "path": "lib/python/orchest-internals/"
            }
        ],
        "settings": {}
    }

Building Orchest
----------------
Last but not least, Orchest needs to be build from source:

.. code-block:: bash

   scripts/build_container.sh

   # By default the scripts builds all containers in parallel. To learn
   # more about other options, such as building without cache, check out
   # the first lines of the script first.
   head -45 scripts/build_container.sh


.. _building the docs:

Building the docs
~~~~~~~~~~~~~~~~~

Our docs are build using `Read the Docs <https://docs.readthedocs.io/>`_ with Sphinx and written in
`reStructuredText <https://www.sphinx-doc.org/en/master/usage/restructuredtext/basics.html>`_.

To build the docs, run:

.. code-block:: bash

   cd docs
   make html

.. tip::
   👉 If you didn't follow the :ref:`prerequisites <development prerequisites>`, then make sure
   you've installed the needed requirements to builds the docs:

   .. code-block:: sh

      python3 -m pip install -r docs/requirements.txt


.. _incremental development:

Incremental development
-----------------------
.. warning::
   🚨 For incremental development to work in WSL2, Docker must be installed within the WSL2
   environment itself.

Now that you have Orchest and all devevelopment dependencies installed you ready to start Orchest in
dev mode by using the ``--dev`` flag. This way code changes are instantly reflected, without having
to build the containers again (although it is good practice to rebuild all containers :ref:`before
committing <before committing>` your changes).

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
* Only the ``orchest-webserver``, ``auth-server`` and ``orchest-api`` support code
  changes to be instantly reflected. For code changes to other services you will have to rebuild the
  container and restart Orchest. To re-build a specific container (e.g. ``orchest-webserver``), run the following command:

.. code-block:: bash

    scripts/build_containers.sh -i orchest-webserver


.. note::
   🎉 Awesome! Everything is set up now and you are ready to start coding. Have a look at our
   :ref:`best practices <best practices>` and our `GitHub
   <https://github.com/orchest/orchest/issues>`_ to find interesting issues to work on.

.. _before committing:

Before committing
-----------------

Make sure your development environment is set up correctly (see :ref:`prerequisites <development
prerequisites>`) so that pre-commit can automatically take care of running the appropriate
formatters and linters when running ``git commit``. Lastly, it is good practice to rebuild all
containers (and restart Orchest) to do some manual testing and running the :ref:`unit tests <unit
tests>` to make sure your changes didn't break anything:

.. code-block:: bash

    # Rebuild containers to do manual testing.
    scripts/build_containers.sh

    # Run unit tests.
    scripts/run_tests.sh

In our CI we also run all of these checks together with :ref:`integration tests <integration tests>`
to make sure the codebase remains stable. To read more about testing, check out the :ref:`testing
<tests>` section.

.. _opening a pr:

Opening a PR
------------

.. note::
   When opening a PR please change the base in which you want to merge from ``master`` to ``dev``.
   The `GitHub docs
   <https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/changing-the-base-branch-of-a-pull-request>`_
   describe how this can be done.

We use `gitflow <https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow>`_ as
our branching model with ``master`` and ``dev`` being the described ``master`` and ``develop``
branches respectively. Therefore, we require PRs to be merged into ``dev`` instead of ``master``.

When opening the PR a checklist will automatically appear to guide you to successfully completing
your PR 🏁.

Python dependencies
~~~~~~~~~~~~~~~~~~~
Python dependencies for the microservices are specified using pip's ``requirements.txt`` files.
Those files are automatically generated by `pip-tools <https://pypi.org/project/pip-tools/>`_
from ``requirements.in`` files by calling ``pip-compile``, which locks all the transitive dependencies.
After a locked ``requirements.txt`` file is in place,
subsequent calls to ``pip-compile`` will not upgrade any of the dependencies
unless the constraints in ``requirements.in`` are modified.

To manually upgrade a dependency to a newer version, there are several options:

.. code-block::

   pip-compile -P <dep>  # Upgrades <dep> to latest version
   pip-compile -U  # Try to upgrade everything

As a general rule, avoid writing exact pins in ``requirements.in``
unless there are known incompatibilities.
In addition, avoid manually editing ``requirements.txt`` files,
since they will be automatically generated.

.. warning::
   A `bug in pip-tools <https://github.com/jazzband/pip-tools/issues/1505>`_ affects local dependencies.
   Older versions are not affected, but they are not compatible with modern pip.
   At the time of writing, the best way forward is to install this fork
   (see `this PR <https://github.com/jazzband/pip-tools/pull/1519>`_ for details):

   .. code-block::

      pip install -U "pip-tools @ git+https://github.com/richafrank/pip-tools.git@combine-without-copy"

Database schema migrations
~~~~~~~~~~~~~~~~~~~~~~~~~~
Whenever one of the services's database models (in their respective ``models.py``) have been
changed, a database migration has to be performed so that all existing users are unaffected by the
schema change on update (since they can then be automatically migrated to the latest version).

.. code-block:: sh

   # Depending on the service that requires schema changes.
   scripts/migration_manager.sh orchest-api migrate
   scripts/migration_manager.sh orchest-webserver migrate

   # For more options run:
   scripts/migration_manager.sh --help

.. _tests:

Testing
-------

.. _unit tests:

Unit tests
~~~~~~~~~~
The unit tests (in particular for the ``orchest-api`` and ``orchest-webserver``) run against a real
database. This, together with additional setup, and the running of all unit tests is done using the
following script:

.. code:: sh

    scripts/run_tests.sh

At this moment we only have unit tests for the Python code.

.. tip::
   👉 If you didn't follow the :ref:`prerequisites <development prerequisites>`, then make sure
   you've installed the needed requirements to run the unit tests:

   .. code-block:: sh

      sudo apt install default-libmysqlclient-dev

.. note::
   For isolation dependencies for the different services are installed within their respective
   virtual environments inside the ``.venvs`` folder.

.. _integration tests:

Integration tests
~~~~~~~~~~~~~~~~~
.. warning::
   🚨 Running integration tests will remove all content of the ``userdir`` directory along with all
   built environments (the provided script will ask you to confirm before proceeding).

The integration tests are build using `Cypress <http://cypress.io/>`_ and can be run using:


.. code:: sh

    scripts/run_integration_tests.sh

Running all the integration tests can take some time, depending on the host running the tests but
also on the browser version, run-times have been observed to range from 15 to 30 minutes.

.. tip::
   👉 Adding the ``-g`` option opens the Cypress GUI. Use ``--help`` to see more options.

Troubleshooting
"""""""""""""""
The script takes care of starting Orchest if it isn't already. On the other hand, if Orchest is
already started, then the script expects Orchest to be running on its default port ``8000``.
