Troubleshooting
===============

When running against issues it can be helpful to increase the verbosity when starting Orchest and
changing the log level of all Orchest's containers. You can do this using:

.. code-block:: sh

   ./orchest start --log-level=DEBUG


Some other Docker commands that can be useful when debugging Orchest:

.. code-block:: sh

   # Inspect the logs of a particular service
   kubectl logs -n orchest -f deployment/orchest-api

   # Attach a shell in a particular service
   kubectl exec -n orchest -it deployment/orchest-api bash

Exit code ``137`` when building Orchest images (scripts/build_containers.sh)
----------------------------------------------------------------------------
For Docker Desktop users, make sure increase the allocated memory to Docker Engine. This can be done
by going to Docker Desktop > Settings > Advanced > Increase the *Memory* slider (`GitHub issue for
reference <https://github.com/moby/moby/issues/22211>`_).

Inspecting the ``orchest-api`` API schema
-----------------------------------------
To develop against the API it can be useful to have a look at the swagger documentation. This can be
done by portforwarding the ``orchest-api`` and visiting the `/api` endpoint.

.. code-block:: sh

   # You will be able to visit `localhost:8000/api`
   kubectl port-forward -n orchest deployment/orchest-api 8000:80

Inspecting the ``orchest-database``
----------------------------------------------
.. code-block:: sh

   kubectl port-forward -n orchest deployment/orchest-database 5432:5432

   # You could accomplish the same by ``exec``ing into the database pod,
   # this can be much more handy since commands history will be
   # preserved through restarts, etc.
   psql -h 127.0.0.1 -p 5432 -U postgres -d orchest_api
   psql -h 127.0.0.1 -p 5432 -U postgres -d orchest_webserver
   psql -h 127.0.0.1 -p 5432 -U postgres -d auth_server

Breaking schema changes
-----------------------
**What it looks like**
    The client can't be accessed (the webserver is not up) or the client can be accessed but a lot
    of functionality seems to not be working, e.g.  creating an environment.

**How to solve**
    .. code-block:: bash

      kubectl port-forward -n orchest deployment/orchest-database 5432:5432
      psql -h 127.0.0.1 -p 5432 -U postgres
      # Once in psql, drop the db of interest.
      drop database orchest_api; # or orchest-webserver, auth-server
      # Exit psql and restart Orchest
      bash orchest restart

    .. note::

      An alternative approach is to reinstall Orchest. ``bash orchest uninstall``
      followed by `bash orchest install``.

**Context**
    Some branches might contain a schema migration that applies changes to the database in a way
    that is not compatible with ``dev`` or any other branch. By moving back to those branches, the
    database has a schema that is not compatible with what's in the code.

**Verify**
    Check the webserver and the api logs. It will be easy to spot because the service won't produce other logs
    but the ones related to incompatible schema changes and database issues.
