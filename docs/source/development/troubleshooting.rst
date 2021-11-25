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

Connecting to a local Postgres database
---------------------------------------
.. note::
   For this to work in Linux you need to have at least Docker version ``Docker 20.10-beta1``
   installed.  More information about support can be found in this `thread on GitHub
   <https://github.com/docker/for-linux/issues/264#issuecomment-714253414>`_.

First, refer to Stack Overflow to learn `how to configure Postgres to listen on all network interfaces
<https://stackoverflow.com/questions/3278379/how-to-configure-postgresql-to-accept-all-incoming-connections>`_
so you can connect from within containers.

Finally, to connect to your host machine from within Orchest you can use ``host.docker.internal``
(which points to ``127.0.0.1`` on your host) as the hostname. This allows you to point to services
running on your host.

.. seealso::

   `Docker networking features <https://docs.docker.com/docker-for-windows/networking/#use-cases-and-workarounds>`_
       Connecting from a container to a service on the host.

