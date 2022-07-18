.. _best practices:

Implementation best practices
=============================

To keep the codebase consistent whilst adding new code, please try to stick to the following best
practices that have served us well so far (grouped by topic). For example, these best practices make
sure it is clear which services touch the filesystem state of Orchest.

API design guidelines
---------------------
New API endpoints should **not** end with trailing slashes. For example, go with ``/api/jobs`` and
not with ``/api/jobs/``.

React
-----
**Don't** use class components **do** use functional components.

Flask
-----
Only write to the ``flask.config`` object on app initialization (Flask's `application factory
<https://flask.palletsprojects.com/en/2.0.x/patterns/appfactories/>`_). Changes to certain values
inside the config object require a restart of the flask application for them to take effect,
therefore the actual state can get out of sync with the state inside the config object when writing
to it.

``userdir``
-----------
The ``orchest-api`` is not allowed to read content from the ``userdir``. It essentially just passes
pointers to the ``celery-worker`` which then does operations on the ``userdir``.

Writing docs
------------
* Captialize words that are primary concepts in the UI, e.g. Pipeline.
