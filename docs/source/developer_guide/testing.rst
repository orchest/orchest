.. _testing:

Testing
=======

We use `Cypress <http://cypress.io/>`_ for our integration tests and `pytest
<https://github.com/pytest-dev/pytest>`_ for our Python tests.

Python tests
------------
Note that running the python tests requires Docker to be installed. This is because
the `orchest-webserver` and `orchest-api` tests run against a real database. The script
will take care of starting the database container and removing it when the tests are
done.

.. code:: sh

    # Will install requirement in their resp. virtualenvs.
    scripts/run_tests.sh

Troubleshooting
~~~~~~~~~~~~~~~
If the script gets into problems related to installing the dependencies in the virtual
environment you likely need to run the following: ``sudo apt install
default-libmysqlclient-dev``.

Integration tests
-----------------
To run the end to end tests we make use of `cypress` and a running instance of Orchest,
`Chrome` is also a requirement.  The provided script takes care of starting Orchest. If
Orchest is already running it's expected to be listening on port ``8000``. Running all the
tests can take some time, depending on the host running the tests but also on the
browser version, run-times have been observed to be between 15 and 30 minutes.

.. code:: sh

    scripts/run_integration_tests.sh

.. warning::
    Running the integration tests implies losing all content of the "data" and
    "userdir/projects" directories, along with all built environments (the script will
    warn you before proceeding).

Commands
~~~~~~~~

Orchest includes a selection of `custom commands
<https://docs.cypress.io/api/cypress-api/custom-commands#Parent-Commands>`_ to ease the writing of
tests:

* ``cy.setOnboardingCompleted(<value>)``
   override the local storage value for whether or not to display the Onboarding Dialog.
* ``cy.getOnboardingCompleted()``
   get the local storage value for whether or not the Onboarding Dialog has been completed.

As well as:

- `Cypress LocalStorage Commands <https://github.com/javierbrea/cypress-localstorage-commands>`_
- `Cypress Testing Library <https://testing-library.com/docs/cypress-testing-library/intro/>`_

Style Guide
~~~~~~~~~~~

Whilst the `official docs <https://docs.cypress.io/>`_ do a great job of covering how to write
tests, here are a few particular things we've found helpful:

Querying Elements
"""""""""""""""""

**Don't** query for specific content, HTML structure or CSS selectors – these methods are brittle
and prone to change.

**Do** use the ``data-test-id`` attribute.

.. code:: html

    <div data-test-id="some-test-id">Content to test</div>

.. code:: ts

    cy.findByTestId("some-test-id").should("exist");

Grouping
""""""""

Organizing tests can be tricky – think of the `test interface
<https://docs.cypress.io/guides/core-concepts/writing-and-organizing-tests#Test-Structure>`_
like a directory tree:

* ``describe()`` – the top-level user-journey or business logic.

   * ``context()`` – shared/similar behavior patterns.

      * ``it()`` – individual/use-case behavior.

Inside each level, make use of hooks to run `shared checks and cleanup
<https://docs.cypress.io/guides/core-concepts/writing-and-organizing-tests#Hooks>`_.

.. tip::
   **For example;** if you're testing a Dialog component, you may want to group various "close" actions
   inside a ``context()``. Inside that ``context()``, an ``afterEach()`` hook could be used to assert
   the Dialog is no longer visible.

Debugging
~~~~~~~~~

By default, Cypress operates as fast as the browser can go – this can make it difficult to debug
tests during development.

To make things easier, try:

* Using ``.only`` to run only the specified step.
* Using ``cy.wait(<ms>)`` to slow steps down arbitrarily.

(Just make sure not to commit these!)
