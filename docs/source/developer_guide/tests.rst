.. _tests:

Tests
=====

Prerequisites
-------------
In order to run both the unit tests and integrations tests on your system, you need to have the
following installed:

* Python version ``3.x``
* Orchest itself, see `installation <installation>`_
* `virtualenv <https://virtualenv.pypa.io/en/latest/installation.html>`_
* `Google Chrome <https://www.google.com/chrome/>`_ (used for integration tests only!)

Next, you will need to install some development dependencies:

.. code:: sh

   # Among other things, this will install Cypress which is used to run
   # the integration tests.
   npm run setup --install && \
        pnpm i

Unit tests
----------
The unit tests (in particular for the ``orchest-api`` and ``orchest-webserver``) run against a real
database. This, together with additional setup, and the running of the tests is managed using the
following script:

.. code:: sh

    scripts/run_tests.sh

At this moment we only have unit tests for the Python code.

.. note::

   Dependencies for the different services are installed within their respective virtual
   environments inside the ``.venvs`` folder.

Troubleshooting
~~~~~~~~~~~~~~~
If the script gets into problems related to installing the dependencies in the virtual
environment you likely need to install some additional dependencies:

.. code-block:: sh

   sudo apt install default-libmysqlclient-dev

Integration tests
-----------------
.. warning::

   Running integration tests will remove all content of the ``userdir`` directory along with all
   built environments (the provided script will ask you to confirm before proceeding).

The integration tests are build using `Cypress <http://cypress.io/>`_ and can be run using:


.. code:: sh

    scripts/run_integration_tests.sh

Running all the tests can take some time, depending on the host running the tests but also on the
browser version, run-times have been observed to be between 15 and 30 minutes.

.. tip::

   You can add ``-g`` if you want to open Cypress GUI. Use ``--help`` to see more options.

Troubleshooting
~~~~~~~~~~~~~~~
The script takes care of starting Orchest if it isn't already. On the other hand, if Orchest is
already started, then the script expects Orchest to be running on its default port ``8000``.
