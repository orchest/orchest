.. _feature manuals:

Feature manuals
===============

A collection of guides on how to work on a given feature or piece of
the codebase.

Telemetry Events
----------------

The Orchest shared library provides a module
(``lib/python/orchest-internals/_orchest/internals/analytics.py``) which allows to send events to
our telemetry backend. The caller of this module, needs, essentially, to provide an **already
anonymized** payload (a dictionary) to the ``send_event`` function along with the event type to
send, e.g. ``project:created``.

If you are tasked with adding new telemetry events, you should:

- find when the event takes place and when to send the telemetry event
- decide the type/name of the event, see the ``analytics`` module for examples. The event
  type must be defined in that module to be sent.
- decide what data to include in the payload.
- send the event.
- if you have access to it, check out our internal analytics backend to make sure the event arrived
  as expected.

If you are looking for a **list of telemetry events that are sent out**, see the ``Event``
enumeration in the shared ``analytics`` module.

Telemetry events from the ``orchest-webserver``
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

This is the simplest case, where you will usually end up calling ``send_event`` in the same endpoint
that produces the event.  Overall, sending a telemetry event translates to a piece of
logic similar to this:

.. code-block:: python

  from _orchest.internals import analytics

  analytics.send_event(
      app,
      analytics.Event.HEARTBEAT_TRIGGER,
      analytics.TelemetryData(
          event_properties={"active": active},
          derived_properties={},
      ),
  )

Telemetry events from the **front-end client**
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
The client sends telemetry events by using the ``orchest-webserver`` as a relay, essentially,
the ``orchest-webserver`` exposes the ``/analytics`` endpoint (``services/orchest-webserver/app/app/views/analytics.py``)
which allows the client to send events as long as the event type exists in the shared ``analytics``
module. The payload should look like the following:

.. code-block:: python

  {
    "event": "my event type",  # e.g. "project:created".
    # Must not contain any sensitive data, i.e. already anonymized.
    "properties": {
      "hello": "world"
    }
  }


Telemetry events from the ``orchest-api``
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
The ``orchest-api`` will automatically take care of sending the telemetry event to the analytics
backend, asynchronously and with retries, once the event is registered in the ``orchest-api`` event
system. A complex way of saying that:

- the ``orchest-api`` has its own event system.

- each ``orchest-api`` event is also defined as an event in the ``analytics`` module and sent out to
  the analytics backend.

- as a "user" of this system, you will have to implement the event (i.e. the content of the
  payload), and register the event when it happens, the equivalent of calling
  ``register_event(my_event)`` in the right places.

See :ref:`Orchest-api Events <telemetry orchest-api>` for a more in depth explanation.


.. _telemetry orchest-api:

Orchest-api Events
------------------
The ``orchest-api`` keeps track of a number of events happening in Orchest, in fact, a dedicated
models module related to events exists, models implemented by the ``orchest-api`` can be found at
``services/orchest-api/app/app/models/`` .

Events are used by the ``orchest-api`` for two reasons: to send them as telemetry events to the
analytics backend, and to use them for user facing notifications. Orchest implements a simple
subscription system where subscribers can subscribe to a number of events. A possible subscriber is
a "webhook", which users can use to get notified of particular events. An analytics subscriber
subscribed automatically to all events exists, which will automatically send out telemetry
events when ``orchest-api`` events are recorded.

When you record an ``orchest-api`` event, subscribers that are subscribed to that
event type will trigger the creation of a delivery record, which is stored in the database
and acts as a transactional outbox. The ``celery-worker`` will periodically check for undelivered
deliveries and send them out. Different deliverees (webhooks, analytics, etc.) have
different delivery implementations.

``orchest-api`` events are implemented through a hierarchy of models backed by a single table
through single table inheritance. Each one of those models must implement its own methods to be
converted to a notification or telemetry payload. Given the nested nature of entities in Orchest,
for example ``project:job:pipeline_run``, what actually happens is that an event representing a
specific layer of this hierarchy will call the parent class to generate a payload, then add it's own
data to the payload, incrementally. See the events models for example.

Steps to implement a new ``orchest-api`` event:

- create the database model by extending an existing ``Event`` class. Implement
  ``to_notification_payload``, which will return the payload that is exposed to
  users through notifications, and ``to_telemetry_payload``, which will return
  the payload that is sent to the analytics backend. This last payload **must**
  be completely anonymized.

- create a schema migration file if the model introduces new columns, i.e.
  ``bash scripts/migration_manager.sh orchest-api migrate``.

- in that same file, or in a new one, add new event types as required by adding
  records to the ``event_types`` table. The ``EventType`` model refers to such
  migrations, that you can use as examples.

- add the required ``register_<event_type>_event`` functions in the ``services/orchest-api/app/app/core/events.py``
  module, these functions will be used to record the event in the ``orchest-api``.

- use the functions you defined to register the event happening in the right places.

- add the event type to the ``Event`` enumeration of the shared analytics module.

- you can now test said event as a user facing notification and, if you have
  access to the analytics backend, you can make sure that the telemetry event is
  delivered (and anonymized!).

SDK data passing
----------------
The :meth:`orchest.transfer.get_inputs` method calls :meth:`orchest.transfer.resolve` which, in
order to resolve what output data the user most likely wants to get, needs a timestamp of the most
recent output for every transfer type. E.g. if some step outputs to disk at 1pm and later outputs to
memory at 2pm, then it is very likely that output data should be retrieved from memory. Therefore,
we adhere to a certain "protocol" for transfers through disk and memory as can be read below.

Disk transfer
~~~~~~~~~~~~~
To be able to resolve the timestamp of the most recent write, we keep a file called ``HEAD`` for
every step. It has the following content: ``timestamp, serialization``, where timestamp is specified
in isoformat with timespec in seconds.


Memory transfer
~~~~~~~~~~~~~~~
When data is put inside the store it is given metadata stating either its serialization or (in case
of an empty message for eviction) the source and target of the output that is stored.

All metadata has to be in ``bytes``, where we use the following encoding:

* ``1;serialization`` where serialization is one of ``["arrow", "arrowpickle"]``.
* ``2;source,target`` where source and target are both UUIDs of the respective steps.

Internally used environment variables
-------------------------------------
When it comes to pipeline execution, each pipeline step is executed in its own environment. More
particularly in its own container. Depending on how the code inside a pipeline step is executed a
number of ENV variables are set by Orchest. The different ways to execute code as part of a pipeline
step are:

* Running the cell of a Jupyter Notebook in JupyterLab,
* Running an interactive run through the pipeline editor,
* Running a non-interactive run as part of a job.

In all of the above mentioned cases the following ENV variables set: ``ORCHEST_PROJECT_UUID``,
``ORCHEST_PIPELINE_UUID`` and ``ORCHEST_PIPELINE_PATH``. Then there is ``ORCHEST_STEP_UUID``, which is
used for data passing, this ENV variable is always present in (non-)interactive runs and in the
Jupyter Notebooks after the first data passing using the :ref:`Orchest SDK`. Additionally, you can
use the following code snippet to get the UUID of the step if it is not yet set inside the
environment:

.. code-block:: python

    import json
    import orchest

    # Put in the relative path to the pipeline file.
    with open("pipeline.orchest", "r") as f:
        desc = json.load(f)

    p = orchest.pipeline.Pipeline.from_json(desc)
    step_uuid = orchest.utils.get_step_uuid(p)

Lastly, there are ``ORCHEST_MEMORY_EVICTION`` and ``ORCHEST_PROJECT_DIR``. The former is never
present when running notebooks interactively and otherwise always present, this means eviction of
objects from memory can never be triggered when running notebooks interactively. The latter is used
to make the entire project directory available through the JupyterLab UI and is thus only set for
interactive Jupyter kernels.
