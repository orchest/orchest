.. _development workflow:

Development workflow
====================

.. _development prerequisites:

Prerequisites
-------------

Required software
~~~~~~~~~~~~~~~~~
In order to code on Orchest, you need to have the following installed on your system:

* Python version ``3.x``
* `Docker <https://docs.docker.com/get-docker/>`_
* `minikube <https://minikube.sigs.k8s.io/docs/start/>`_
* `helm <https://helm.sh/docs/intro/install/>`_ (if you intend to develop files in ``/deploy``)
* `kubectl <https://kubernetes.io/docs/tasks/tools/#kubectl>`_ (you might want to try out a tool
  like ``k9s`` in the long run)
* `pre-commit <https://pre-commit.com/#installation>`_ 

  * `install go <https://go.dev/doc/install>`_ if you work on the controller

* `npm <https://docs.npmjs.com/downloading-and-installing-node-js-and-npm>`_ and `pnpm
  <https://pnpm.io/installation#using-npm>`_
* `jq <https://stedolan.github.io/jq/>`_ (useful when working with JSON in your terminal)
* `Google Chrome <https://www.google.com/chrome/>`_ (integration tests only)

.. _cluster mount:

Cluster for development
~~~~~~~~~~~~~~~~~~~~~~~
Currently, the development scripts/tools assume that you are have Orchest installed in minikube.
It is recommended, but not mandatory, to mount the Orchest repository in minikube,
which allows redeploying services and :ref:`incremental development <incremental development>`:

.. code-block:: bash

   # Delete any existing cluster
   minikube delete

   # Start minikube with the repository mounted in the required place.
   # Run this command while you are in the Orchest repository directory.
   minikube start \
     --cpus 6 \
     --mount-string="$(pwd):/orchest-dev-repo" --mount

After the minikube cluster is created, follow the steps of a
regular installation.

.. include:: ../fragments/regular-installation.rst

Installing Orchest for development
----------------------------------

Development environment
~~~~~~~~~~~~~~~~~~~~~~~
Run the code below to install all dependencies needed for :ref:`incremental
development <incremental development>`, :ref:`building the docs <building the docs>`,
:ref:`running tests <tests>`, and automatically running pre-commit hooks:

.. code-block:: bash

   # Make sure you are inside the orchest root directory

   # pre-commit hooks
   pre-commit install

   # Dependencies to run unit tests
   sudo apt-get install -y default-libmysqlclient-dev

   # Frontend dependencies for incremental development
   npm run setup --install && pnpm i

   # Dependencies to build the docs
   python3 -m pip install -r docs/requirements.txt

Building services locally
~~~~~~~~~~~~~~~~~~~~~~~~~
To easily test code changes of an arbitrary service, you will need to 1) rebuild the service image
and 2) make it available to the k8s deployment. The procedure changes slightly
depending on the deployment type.

Single node
+++++++++++
Generally speaking, single node deployments make it far easier to test changes.
For example, to make changes on the ``orchest-api`` service, do the following:

.. code-block:: bash

    # Verify if in-node docker engine is active
    [[ -n "${MINIKUBE_ACTIVE_DOCKERD}" ]] && echo $MINIKUBE_ACTIVE_DOCKERD || echo "Not active"

    # If not active, set it
    eval $(minikube -p minikube docker-env)

    # Save the Orchest version in use
    export TAG=$(orchest version --json | jq -r .version)

    # Build the desired image
    scripts/build_container.sh -i orchest-api -t $TAG -o $TAG

    # Kill the pods of the orchest-api, so that the new image gets used
    # when new pods are deployed
    kubectl delete pods -n orchest -l "app.kubernetes.io/name=orchest-api"

Alternatively, you can run ``scripts/build_container.sh -m -t $TAG -o $TAG``
to rebuild the minimal required set of images.

Multi node
++++++++++
The procedure above is not possible in multi node deployments though,
and it's also error prone when it comes to setting the right tag, label, etc.
For this reason, we provide the following scripts:

.. code-block:: bash

    # Redeploy a service after building the image using the repo code.
    # This is the script that you will likely use the most. This script
    # assumes Orchest is installed and running, since it interacts with
    # an Orchest service.
    bash scripts/redeploy_orchest_service_on_minikube.sh orchest-api

    # Remove an image from minikube. Can be useful to force a pull from
    # a registry.
    bash scripts/remove_image_from_minikube.sh orchest/orchest-api

    # Build an image with a given tag, on all nodes.
    bash scripts/build_image_in_minikube.sh orchest-api v2022.03.7

    # Run arbitrary commands on all nodes.
    bash scripts/run_in_minikube.sh echo "hello"

.. warning::
   The redeploy and build_image scripts require the Orchest repository
   :ref:`to be mounted in minikube <cluster mount>`.
   However, note that multi node mounting might not be supported by all minikube drivers.
   We have tested with docker, the default driver.

.. _incremental development:

Incremental development (hot reloading)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
The steps above allow you to rebuild the images for the services.
In addition, you can also set Orchest to run in dev mode with ``orchest patch --dev``
so that code changes are instantly reflected, without having to build the containers again.
The services that support dev mode are:

- ``orchest-webserver``
- ``orchest-api``
- ``auth-server``

.. note::
   It is good practice to rebuild all containers :ref:`before committing <before committing>`
   your changes.

.. code-block:: bash

   # In case any new dependencies were changed or added they need to
   # be installed.
   pnpm i

   # Run the client dev server for hot reloading of client (i.e. FE) files.
   pnpm run dev &

   orchest start

   orchest patch --dev


.. note::
   🎉 Awesome! Everything is set up now and you are ready to start coding. Have a look at our
   :ref:`best practices <best practices>` and our `GitHub
   <https://github.com/orchest/orchest/issues>`_ to find interesting issues to work on.

.. _tests:

Testing
-------

.. _unit tests:

Unit tests
~~~~~~~~~~
Unit tests are being ported to k8s, stay tuned :)!

..
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
Integration tests are being ported to k8s, stay tuned :)!

..
    .. warning::
    🚨 Running integration tests will remove all content of the ``userdir`` directory along with all
    built environments (the provided script will ask you to confirm before proceeding).

    ..
    The integration tests are build using `Cypress <http://cypress.io/>`_ and can be run using:


    ..
    .. code:: sh

        scripts/run_integration_tests.sh

    ..
    Running all the integration tests can take some time, depending on the host running the tests but
    also on the browser version, run-times have been observed to range from 15 to 30 minutes.

    ..
    .. tip::
    👉 Adding the ``-g`` option opens the Cypress GUI. Use ``--help`` to see more options.

    Troubleshooting
    """""""""""""""
    The script takes care of starting Orchest if it isn't already. On the other hand, if Orchest is
    already started, then the script expects Orchest to be running on its default port ``8000``.

Making changes
--------------

.. _before committing:

Before committing
~~~~~~~~~~~~~~~~~
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

In our CI we also run all of these checks together with :ref:`integration
tests <integration tests>` to make sure the codebase remains stable. To read more about testing,
check out the :ref:`testing <tests>` section.

IDE & language servers
~~~~~~~~~~~~~~~~~~~~~~
.. note::
   👉 This section is for VS Code and `pyright <https://github.com/microsoft/pyright>`_ users.

If you use VS Code (or the `pyright <https://github.com/microsoft/pyright>`_ language server to be
more precise) the different services contain their own ``pyrightconfig.json`` file
that configures smart features such as auto complete, go to definition, find all references,
and more. For this to work, you need to install the dependencies of the services in the correct
virtual environment by running:

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

Python dependencies
~~~~~~~~~~~~~~~~~~~
Python dependencies for the microservices are specified using pip's ``requirements.txt`` files.
Those files are automatically generated by `pip-tools <https://pypi.org/project/pip-tools/>`_
from ``requirements.in`` files by calling ``pip-compile``, which locks all the transitive
dependencies. After a locked ``requirements.txt`` file is in place,
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
   A `bug in pip-tools <https://github.com/jazzband/pip-tools/issues/1505>`_ affects local
   dependencies. Older versions are not affected, but they are not compatible with modern pip.
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

.. _building the docs:

Building the docs
-----------------

Our docs are build using `Read the Docs <https://docs.readthedocs.io/>`_ with Sphinx and written
in `reStructuredText <https://www.sphinx-doc.org/en/master/usage/restructuredtext/basics.html>`_.

To build the docs, run:

.. code-block:: bash

   cd docs
   make html

.. tip::
   👉 If you didn't follow the :ref:`prerequisites <development prerequisites>`, then make sure
   you've installed the needed requirements to builds the docs:

   .. code-block:: sh

      python3 -m pip install -r docs/requirements.txt

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
your PR 🏁
