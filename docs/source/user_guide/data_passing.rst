.. _data passing:

Passing data between pipeline steps
===================================

To pass data between the different pipeline steps, across different languages, we make use of the
`Apache Arrow <https://github.com/apache/arrow>`_ project. The :ref:`Orchest SDK` provides a
convenience wrapper of the project to be used within Orchest.

See the :ref:`data passing quickstart<sdk-quickstart-data-passing>` of the SDK to get started
directly.

.. _connections:

Connections
-----------
The image below is a screenshot from the properties pane of step that has incoming steps "A", "B"
and "C". The order of the list can be changed with a simple drag and drop.

.. image:: ../img/step-connections.png
  :width: 300
  :alt: From top to bottom: A -> C -> B
  :align: center

The order of this list is important as it determines the order in which the receiving step obtaines
data from the steps A, B and C when calling :meth:`orchest.transfer.get_inputs`. In the example
image above the receiving step would get a list with the data from steps A, C and B respectively.

.. note::
   The Orchest SDK actually infers the order via the pipeline definition. The UI simply stores the
   order in the pipeline definition file.


Memory data passing
-------------------
Coming soon!

.. TODO(yannick)

.. Notion of memory-server per pipeline.

.. Passing data from one step to another (using :meth:`orchest.transfer.output`) passes data through
.. memory by default. When passing data from some step "A" to some step "B", then the object passed at
.. A would be stored in memory so B can retrieve it. The object will be copied to the memory of step B,
.. leaving a copy in the memory-server. This is useful in interactive runs as it allows you to rerun
.. certain step without having to run the steps it depends on (if they have run before).

.. To clear memory use auto eviction.

   Also refer to pipeline level configurations after talking about how the memory server works!
   The user needs to understand when objects are evicted (and the special kernel case).
