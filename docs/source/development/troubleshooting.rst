Troubleshooting
===============

When running against issues it can be helpful to increase the verbosity when starting Orchest and
changing the log level of all Orchest's containers. You can do this using:

.. code-block:: sh

   ./orchest -vvv start --log-level=DEBUG


Some other Docker commands that can be useful when debugging Orchest:

.. code-block:: sh

   # List all containers that Orchest is running
   docker ps -a -f network=orchest

   # Inspect the logs of a particular service
   docker logs orchest-webserver

   # Attach a shell in a particular service
   docker exec -it orchest-webserver /bin/bash

Exit code ``137`` when building Orchest
---------------------------------------
For Docker Desktop users, make sure increase the allocated memory to Docker Engine. This can be done
by going to Docker Desktop > Settings > Advanced > Increase the *Memory* slider (`GitHub issue for
reference <https://github.com/moby/moby/issues/22211>`_).

Inspecting the ``orchest-api`` API schema
-----------------------------------------
To develop against the API it can be useful to have a look at the swagger documentation. This can be
done by:

.. code-block:: sh

   # Start Orchest using --dev so that the orchest-api is exposed at
   # port 8080
   ./orchest start --dev

   # Now you can visit `localhost:8080/api`

Inspecting ``orchest-database`` using Postgres
----------------------------------------------
.. code-block:: sh

    docker exec -it orchest-database /bin/bash

   # Connect to a database as a user.
   # The -U and -d values can be found in the config.py
   # of the resp. services.
   psql -U postgres -d orchest_api

Breaking schema changes
-----------------------
**What it looks like**
    The client can't be accessed (the webserver is not up) or the client can be accessed but a lot
    of functionality seems to not be working, e.g.  creating an environment.

**How to solve**
    .. code-block:: bash

       # Remove the database by cleaning the entire userdir.
       scripts/clean_userdir.sh

       # To restart Orchest and clean the database.
       ./orchest stop && scripts/clean_userdir.sh && ./orchest start --dev

    .. note::

       This approach will wipe your entire ``userdir``, meaning that you will lose all Orchest state. An
       alternative is to just remove the database directory ``userdir/.orchest/database``.

**Context**
    Some branches might contain a schema migration that applies changes to the database in a way
    that is not compatible with ``dev`` or any other branch. By moving back to those branches, the
    database has a schema that is not compatible with what's in the code.

**Verify**
    Check the webserver and the api logs by using ``docker logs orchest-webserver`` or ``docker logs
    orchest-api``. It will be easy to spot because the service won't produce other logs but the ones
    related to incompatible schema changes.
