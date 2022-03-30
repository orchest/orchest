.. _development workflow:

Development workflow
====================

.. _development prerequisites:

Prerequisites
-------------
In order to code on Orchest, you need to have the following installed on your system:

* Python version ``3.x``
* `Docker <https://docs.docker.com/get-docker/>`_
* `minikube <https://minikube.sigs.k8s.io/docs/start/>`_
* `helm <https://helm.sh/docs/intro/install/>`_ (if you intend to develop files in ``/deploy``)
* `kubectl <https://kubernetes.io/docs/tasks/tools/#kubectl>`_ (you might want to try out a tool like ``k9s`` in the long run)
* `pre-commit <https://pre-commit.com/#installation>`_
* `npm <https://docs.npmjs.com/downloading-and-installing-node-js-and-npm>`_ and `pnpm
  <https://pnpm.io/installation#using-npm>`_
* `virtualenv <https://virtualenv.pypa.io/en/latest/installation.html>`_
* `Google Chrome <https://www.google.com/chrome/>`_ (integration tests only)

Currently, the development scripts/tools assume that you are running Orchest in minikube.
If you have managed to successfully :ref:`install <installation>` Orchest in minikube
now it's the time to setup your development environment.

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

Working with Orchest
--------------------
To easily test code changes of an arbitrary service, you will need to 1) rebuild the service image and 2)
make it so that the k8s deployment backing that Orchest service gets redeployed in order to use the
newly built image. You could be running minikube in multi node or single node, generally speaking,
single node deployments make it far easier to test changes, for example, you could do the following:

.. code-block:: bash

    # Make use of the in-node docker engine.
    eval $(minikube -p minikube docker-env)

    # Build the desired image. The tag to be passed is the image tag
    # that the deployment of the Orchest service is using, see "kubectl
    # get deployments -n orchest orchest-api -o wide" as an example.
    # Example tag: 2022.03.8.
    scripts/build_container.sh -i orchest-api \
        -t <image tag of the deployment of the orchest service> \
        -o <image tag of the deployment of the orchest service>

    # Kill the pods of the orchest-api, so that the new image gets used
    # when new pods are deployed. This assumes that Orchest has already
    # been installed.
    kubectl delete pods -n orchest -l "app.kubernetes.io/name=orchest-api"

This, however, wouldn't be possible in multi node deployments, and it's also error prone
when it comes to setting the right tag, label, etc. For this reason, we provide the
following scripts:

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

**The redeploy and build_image scripts require the Orchest repository
to be mounted in minikube**. One way to do that is to mount it on start, for example, ``minikube
start --memory 16000 --cpus 6 --mount-string="$(pwd):/orchest-dev-repo" --mount``, you will need to
be in the Orchest repository (note the ``$(pwd)``). Note that multi node mounting might not be
supported by all minikube drivers. We have tested with the default driver, docker.

.. _incremental development:

Incremental development (hot reloading)
---------------------------------------
Now that you have Orchest and all development dependencies installed you are ready to start Orchest
in dev mode by using the ``--dev`` flag. This way code changes are instantly reflected, without
having to build the containers again (although it is good practice to rebuild all containers
:ref:`before committing <before committing>` your changes). The services that support
dev mode are:

- ``orchest-webserver``
- ``orchest-api``
- ``auth-server``

.. code-block:: bash

   # Start minikube with the repository mounted in the required place.
   # Run this command while you are in the Orchest repository directory.
   minikube start --memory 16000 --cpus 6 \
    --mount-string="$(pwd):/orchest-dev-repo" --mount

   # In case any new dependencies were changed or added they need to
   # be installed.
   pnpm i

   # Run the client dev server for hot reloading of client (i.e. FE)
   # files. Note: This command does not finish.
   pnpm run dev

   # Start Orchest in --dev mode.
   ./orchest start --dev

.. note::
   🎉 Awesome! Everything is set up now and you are ready to start coding. Have a look at our
   :ref:`best practices <best practices>` and our `GitHub
   <https://github.com/orchest/orchest/issues>`_ to find interesting issues to work on.

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

