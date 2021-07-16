.. _testing:

Testing
=======

We use `Cypress <http://cypress.io/>`__ for all things testing – a key part of our GitHub Action-based continuous integration.

CLI
---

Run the `Test Runner <https://www.cypress.io/features>`__ against `localhost:8000 <https://localhost:8000>`__ (regardless of production or development mode)

::

    pnpm run cy:open

Commands
--------

Orchest includes a selection of `custom commands <https://docs.cypress.io/api/cypress-api/custom-commands#Parent-Commands>`__ to ease the writing of tests:

-  ``cy.setOnboardingCompleted(<value>)``
   override the local storage value for whether or not to display the Onboarding Dialog.
-  ``cy.getOnboardingCompleted()``
   get the local storage value for whether or not the Onboarding Dialog has been completed.

As well as: 

- `Cypress LocalStorage Commands <https://github.com/javierbrea/cypress-localstorage-commands>`__ 
- `Cypress Testing Library <https://testing-library.com/docs/cypress-testing-library/intro/>`__

Style Guide
-----------

Whilst the `official docs <https://docs.cypress.io/>`__ do a great job of covering how to write tests, here are a few particular things we've found helpful:

Querying Elements
~~~~~~~~~~~~~~~~~

**Don't** query for specific content, HTML structure or CSS selectors – these methods are brittle and prone to change.

**Do** use the ``data-test-id`` attribute.

.. code:: html

    <div data-test-id="some-test-id">Content to test</div>

.. code:: ts

    cy.findByTestId("some-test-id").should("exist");

Grouping
~~~~~~~~

Organizing tests can be tricky, but it doesn't have to be - think of it like a tree:

-  Wrap your entire specification with a ``describe()``.
-  Group similar behaviours with ``context()``.

   -  Use hooks to run `shared checks and cleanup <https://docs.cypress.io/guides/core-concepts/writing-and-organizing-tests#Hooks>`__.
   -  Write each test in an ``it()``.

If you're still stuck, see `onboarding.spec.ts <https://github.com/orchest/orchest/blob/master/cypress/integration/onboarding.spec.ts>`__.

Slowing Things Down
~~~~~~~~~~~~~~~~~~~

By default, Cypress operates as fast as the browser can go – this can make it difficult to see if your tests are working during development.

To make things easier, try:

- Using ``.only`` to run only the specified step.
- Using ``cy.wait(<ms>)`` to slow steps down arbitrarily.

(Just make sure not to commit these)