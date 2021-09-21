.. _data passing:

Passing data between pipeline steps
===================================

To pass data between the different pipeline steps, across different languages, we make use of the
`Apache Arrow <https://github.com/apache/arrow>`_ project. The :ref:`Orchest SDK` provides a
convenience wrapper of the project to be used within Orchest.

See the :ref:`data passing quickstart <sdk-quickstart-data-passing>` of the SDK to get started
directly.

Python example
--------------

.. code-block:: python

   import orchest

   # Get data from incoming steps.
   input_data = orchest.get_inputs()

   # Create new data that you would like to pass to next steps.
   data = "Hello, World!"

   # Output the data.
   orchest.output(data, name="some-data")

Memory data passing
-------------------
To pass data through memory between steps (which is enabled by default) we make use of `the Plasma
in-memory object store <https://arrow.apache.org/docs/python/plasma.html>`_ from the Apache Arrow
project. Within Orchest it is wrapped with additional code for object eviction, which we will cover
later in this section. Every interactive session gets its own memory store, which is shared between
the kernels and interactive runs, for pipeline runs as part of jobs each gets an isolated
memory store.

When an object is sent from one step to another (using :meth:`orchest.transfer.output`) it is
actually stored inside the Plasma store and copied into the memory of the receiving step. This is
useful in interactive runs as it allows you to rerun a certain step without having to run the steps it
depends on (if they have run before) enabling faster iteration on your ideas.

When it comes to clearing the memory store there are two options:

1. Clearing all objects from memory through the pipeline settings.
2. Enabling auto eviction also through the pipeline settings, additional information about this
   setting can be found in :ref:`pipeline level configurations <pipeline configuration>`.

.. _connections:

Connections
-----------
.. note::
   This section only applies when you are outputting unnamed data, i.e.
   calling :meth:`orchest.transfer.output` with ``name=None``.

The image below is a screenshot from the properties pane of step that has incoming steps "A", "B"
and "C". The order of the list can be changed with a simple drag and drop.

.. image:: ../img/step-connections.png
  :width: 300
  :alt: From top to bottom: A -> C -> B
  :align: center

The order of this list is important as it determines the order in which the receiving step obtains
data from the steps A, B and C when calling :meth:`orchest.transfer.get_inputs`. In the example
image above, under the assumption that all steps called :meth:`orchest.transfer.output` with
``name=None``, the receiving step would get the following data structure (when calling
:meth:`orchest.transfer.get_inputs`):

.. code-block:: python

   # Note the order!
   {'unnamed': ['A', 'C', 'B']}

.. note::
   The Orchest SDK actually infers the order via the pipeline definition. The UI simply stores the
   order in the pipeline definition file.
