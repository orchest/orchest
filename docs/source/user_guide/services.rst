.. _Services:

========
Services
========

You might need a **Redis** instance, a **database**, **Tensorboard** or another "service"
to be running with your pipeline, with a **lifetime that spans across the entire session**.
This service can persist to disk or be configured to be reachable from your browser.  This
is exactly what services in Orchest are for. 

To add a service to your Orchest pipeline, go to the `pipeline settings` and check
out the `services` tab.

.. _Ready to go templates:

Ready to go templates
=====================
For ease of use, we provide some common docker images as templates: 

- Redis
- Postgres
- Tensorboard
- Streamlit
- VS-Code

Tensorboard, Streamlit and Code-server are set up to be reachable from
your browser, the link will be available both in the pipeline editor under
`services` and in the service configuration settings. Redis and Postgres can
will only be reachable from within Orchest, i.e. from pipeline steps or notebooks. 

After adding Redis or Postgres as services, you can use the following
snippets of code to verify connectivity.

Redis 
-----

Assumes ``redis-py`` has been installed in the environment used by the step,
e.g. ``pip install redis``.

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


.. _The details:

The details
===========
After going to `pipeline settings`, `services`, and clicking on the `Add Service` 
button, you will have the option to create a custom service, where you can
pin down your specs.

.. note::
   Checkout the service templates as a starting point.

Required fields:

- **name**: The name of the server.
- **image**: The image to use for the service.

Non required fields:

- **command**: Service start command, e.g. what process the service will run.
- **entrypoint**: `command` and `entrypoint` are a 1:1 mapping to Docker, refer to the `Docker docs <https://docs.docker.com/engine/reference/builder/#cmd>`_ for their difference and gotchas.
- **inherited environment variables**: A list of environment variable names that will be
  inherited from the project and pipeline environment variables.
- **environment variables**: Key-value pairs of environment variables, take priority over
  the inherited ones.
- **scope**: To specify if the service should be running in interactive mode, jobs, or both.
- **project directory mount**: To bind a service file system path to the directory of the project. This
  will allow the service to read or write to the project directory. See the VS-Code template
  for an example. Note that the project directory of a job is an internal snapshot.
- **data directory mount**: To bind a service file system path to the Orchest data
  directory. This directory is the same across interactive runs, job runs and notebooks.
- **ports**: 

Gotchas
-------


.. _Orchest environments as services:

Orchest environments as services
================================
It might be the case that a predefined image from dockerhub needs to be extended
to your needs by installing a package, writing some configuration files, etc.
A service can be defined to use an Orchest environment as its image, so that 
you can iterate on and customize any service without the burden of interacting with
docker or pushing to a image repository.

See the :ref:`Environments <environments>` section for details on how to build an
environment.

