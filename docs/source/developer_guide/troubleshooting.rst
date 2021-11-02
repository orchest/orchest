Troubleshooting
===============

Breaking schema changes
-----------------------

**What it looks like**: the client can't be accessed (the webserver is not up) or
the client can be accessed but a lot of functionality seems to not be working, e.g.
creating an environment.

**How to solve**:

.. code-block:: bash

   # Remove the database by cleaning the entire userdir.
   scripts/clean_userdir.sh

   # To restart Orchest and clean the database.
   ./orchest stop && scripts/clean_userdir.sh && ./orchest start --dev

.. note::

   This approach will wipe your entire ``userdir``, meaning that you will lose all Orchest state. An
   alternative is to just remove the database directory ``userdir/.orchest/database``.

**Context**: Some branches might contain a schema migration that applies changes to the
database in a way that is not compatible with ``dev`` or any other branch. By moving back
to those branches, the database has a schema that is not compatible with what's in the code.

**Verify**: Check the webserver and the api logs by using ``docker logs orchest-webserver``
or ``docker logs orchest-api``. It will be easy to spot because the service won't produce
other logs but the ones related to incompatible schema changes.
