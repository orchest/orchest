.. _Services:

========
Services
========

What's a service?
=====================

You might need a **database**, a **Redis** instance, **Tensorboard** or another "service"
to be running with your pipeline, with a **lifetime that spans across the entire session**.
This service can persist to disk and be configured to be reachable from your browser.  This
is exactly what services in Orchest are for. 

To add a service to your Orchest pipeline, go to the `pipeline settings` and check
out the `services` tab.

.. _Ready to go templates:

Ready to go templates
=====================
For ease of use, we provide some common docker images as templates: 

.. figure:: ../img/overview/services.png
   :width: 400
   :align: center

Tensorboard, Streamlit and Code-server are set up to be reachable from
your browser, the link will be available both in the pipeline editor under
`services` and in the service configuration settings. Redis and Postgres
will only be reachable from within Orchest, i.e. from pipeline steps, notebooks 
and other services.

After adding Redis or Postgres as services, you can use the following
snippets of code to verify connectivity.

Redis 
-----

Assumes ``redis-py`` has been installed in the environment used by the step,
e.g. ``pip install redis``, see the :ref:`Environments <environments>` section.



.. code-block:: python

   import orchest
   import redis

   redis_host = orchest.get_service("redis")["internal_hostname"]
   redis_client = redis.Redis(host=redis_host, port=6379, db=0)
   redis_client.set("hello", "there")
   redis_client.get("hello")

Postgres
--------

Assumes ``psycopg2`` has been installed in the environment used by the step,
e.g. ``pip install psycopg2-binary``.

.. code-block:: python

   import orchest
   import psycopg2

   postgres_host = orchest.get_service("postgres")["internal_hostname"]
   conn = psycopg2.connect(dbname="postgres", user="postgres", host=postgres_host)
   cur = conn.cursor()
   cur.execute("CREATE TABLE test (id serial PRIMARY KEY, num integer, data varchar);")
   cur.execute("INSERT INTO test (num, data) VALUES (%s, %s)", (1337, "hello"))
   cur.execute("SELECT * FROM test;")
   cur.fetchone()


.. _Logs:

Logs
====

You can keep track of all your services (and steps) logs through the `LOGS` button
in the pipeline editor.

.. figure:: ../img/logs-pointer.png
   :width: 600
   :align: center

.. figure:: ../img/service-logs.png
   :align: center


.. _The details:

The details
===========
After going to `pipeline settings`, `services`, and clicking on the `Add Service` 
button, you will have the option to create a custom service, where you can
pin down your specs.

.. tip::
  The service templates can serve as a starting point, check them out!

Required fields:

- **name**: The name of the server.
- **image**: The image to use for the service.

Non required fields:

- **command**: Service start command, e.g. what process the service will run.
- **entrypoint**: `command` and `entrypoint` are a 1:1 mapping to Docker, refer to the `Docker docs <https://docs.docker.com/engine/reference/builder/#cmd>`_ for their difference and gotchas.
- **inherited environment variables**: A list of environment variable names that will be
  inherited from the project and pipeline environment variables.
- **environment variables**: Key-value pairs of environment variables, take priority over
  the inherited ones. Note that, while project and pipeline environment variables
  are considered as `secrets`, services environment variables aren't and will
  be persisted in the pipeline definition file.
- **scope**: To specify if the service should be running in interactive mode, jobs, or both.
- **project directory mount**: To bind a service file system path to the directory of the project. This
  will allow the service to read or write to the project directory. See the VS-Code template
  for an example. Note that the project directory of a job is an internal snapshot.
- **data directory mount**: To bind a service file system path to the Orchest data
  directory. This directory is the same across interactive runs, job runs and notebooks.
- **ports**: the ports that the service will be listening on when it comes to external
  connectivity. You don't have to add any port if you are only interested in a
  service being reachable by notebooks and pipeline steps, which we refer to as
  internal connectivity. A service that has defined ports will be reachable from
  outside of Orchest through a special URL, **on all ports**. Currently, 
  only the `http` protocol is supported. The URL(s) through which you can
  connect to an externally reachable service is shown in the service settings
  and the pipeline editor, through the "SERVICES" button.
- **preserve base path**: Some applications use relative paths when it comes
  to handling URLS, e.g. for web page assets such as images, javascript code, css.
  Others will expect the base path to be preserved when being proxied. The need for
  toggling this is based on the specific application at hand, and it's only of interest
  for external connectivity.

  .. figure:: ../img/services-pointer.png
    :width: 600
    :align: center

.. tip::
  Most images that provide some sort of server are already set to bind to the
  required interfaces to expose said server. That might not be always the
  case, or you might have to explicitly set it while changing the `command` that
  the image runs. The way said bindings are set is application dependant, for
  example, `Tensorboard` provides the flag ``--bind_all`` to bind on all
  interfaces.

Permissions of files written by a service
-----------------------------------------

If you make use of the project or data directory mounts, it's because you
might need a service to write some data. To make sure that data is written
with the correct permissions, change the ``umask`` of the container process.

Let's take, for example, the `Tensorboard` template. Normally, the command would
look like ``tensorboard --logdir /data --bind_all``, in the template we are
setting the umask of the `Tensorboad` process, this means:

- setting the entrypoint as ``bash``
- setting the service command as ``-c 'umask 002 && tensorboard --logdir /data --bind_all'``


.. _Orchest environments as services:

Orchest environments as services
================================
It might be the case that a predefined image from dockerhub needs to be extended
to your needs by installing a package, writing some configuration files, etc.
A service can be defined to use an Orchest environment as its image so that 
you can iterate on and customize any service without the burden of interacting with
docker or pushing to an image repository.

See the :ref:`Environments <environments>` section for details on how to build an
environment.

