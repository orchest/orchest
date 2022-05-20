.. _feature manuals:

Feature Manuals
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

- find when the event takes place and when to send the telemetry event, i.e. synchronously
  or asynchronously
- decide the name of the event, see the ``analytics`` module for examples
- decide what data to include in the payload
- send the event
- if you have access to it, check out our internal analytics backend to make sure the event arrived
  as expected

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
which allows the client to send events as long as the event types exists in the shared ``analytics``
module. The payload should look like the following:

.. code-block:: python

  {
    "event": "my event type"
  #  Must not contain any sensitive data, i.e. already anonymized.
    "properties": {
      "hello": "world"
    }
  }


Telemetry events from the ``orchest-api``
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
The ``orchest-api`` will automatically take care of sending the telemetry event to the analytics
backend, asynchronously and with retries, once the event is registered in the ``orchest-api`` event
system. A complex way of saying that:

- the ``orchest-api`` has its own event system

- each ``orchest-api`` event is also defined as an event in the ``analytics`` module and sent out to
  the analytics backend

- as a "user" of this system, you will have to implement the event (i.e. the content of the
  payload), and register the event when it happens, the equivalent of calling
  ``register_event(my_event)`` in the right places

See :ref:`Orchest-api Events <telemetry orchest-api>` for a more in depth explanation.


.. _telemetry orchest-api:
