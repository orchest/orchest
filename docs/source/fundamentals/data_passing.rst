.. _data passing:

Data passing
============

To pass data between the different pipeline steps, across different languages, we make use of the
`Apache Arrow <https://github.com/apache/arrow>`_ project. The :ref:`Orchest SDK` provides a
convenience wrapper of the project to be used within Orchest.

:ref:`data passing API reference <api transfer>`

Python example
--------------
The SDK manages the target and source of the data, leaving you only with the decision what data to
pass. The target and source of the data are inferred through the :ref:`pipeline definition <pipeline
definition>`.

For this example we let the pipeline be defined as follows:

.. image:: ../img/pipeline.png
  :width: 400
  :alt: Pipeline defined as: step-1, step-2 --> step-3
  :align: center

.. note::
   In this example we will name the data we output in the steps. It is also possible to use
   ``name=None`` and obtain the data using the ``"unnamed"`` key, which allows you treat the inputs
   as a collection. Additionally, there is an implied order of data in ``"unnamed"``, for more
   information please read the dedicated :ref:`connections section <connections>`.


.. code-block:: python

   """step-1"""
   import orchest

   data = "Hello, World!"

   # Output the data so that step-3 can retrieve it.
   orchest.output(data, name="my_string")


.. code-block:: python

   """step-2"""
   import orchest

   data = [3, 1, 4]

   # Output the data so that step-3 can retrieve it.
   orchest.output(data, name="my_list")


.. code-block:: python

   """step-3"""
   import orchest

   # Get the input for step-3, i.e. the output of step-1 and step-2.
   input_data = orchest.get_inputs()

   print(input_data)
   # {
   #  "my_list": [3, 1, 4],
   #  "my_string": "Hello, World!"
   # }

.. note::
   Memory eviction of objects is disabled by default, refer to :ref:`configuration <configuration>`
   to learn how to enable it.

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
