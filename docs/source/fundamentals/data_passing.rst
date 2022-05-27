.. _data passing:

Data passing
============

We use `Apache Arrow <https://github.com/apache/arrow>`_ to pass data between Pipeline steps and
across different languages. The :ref:`Orchest SDK` wraps `Apache Arrow
<https://github.com/apache/arrow>`_ so that it can be used in Orchest.

See the full :ref:`data passing API reference <api transfer>` for more information.

Python example
--------------

In this example, we show how to pass data between different pipeline steps using Python.

Using the following pipeline:

.. figure:: ../img/pipeline.png
   :width: 400
   :alt: Pipeline defined as: step-1, step-2 --> step-3
   :align: center

We will create and name data in steps 1 and 2, and pass it to step 3.

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

The output data from steps 1 and 2 is copied to shared memory so that step 3 can access it. This
also lets us access the data in JupyterLab.

.. code-block:: python

   """step-3"""
   import orchest

   # Get the input for step-3, i.e. the output of step-1 and step-2.
   input_data = orchest.get_inputs()

.. warning::
   🚨 Only call :meth:`orchest.transfer.get_inputs` and :meth:`orchest.transfer.output` once.
   Otherwise your code will break in :ref:`jobs <jobs>` and overwrite data.

Step 3's ``input_data`` will be:

.. code-block:: json

   {
    "my_list": [3, 1, 4],
    "my_string": "Hello, World!",
    "unnamed": []
   }

We will discuss ``unnamed`` in the next section.

Passing data without a name
---------------------------

It's best practice to pass data with a name in most cases. However, sometimes you may want to use a
list rather than a dictionary to store your data. Therefore, it's not necessary to give outputted
data a name.

When passing unnamed data, the receiving step treats the values as an ordered collection (see
:ref:`order of unnamed data <unnamed order>`). In the previous example, step 3 receives input data
with a special key called ``unnamed``.

If we change the output of step 1 to:

.. code-block:: python

   """step-1"""
   import orchest

   data = "Hello, World!"

   # Output the data so that step-3 can retrieve it.
   # But this time, don't give a name.
   orchest.output(data, name=None)

The ``input_data`` in step 3 would then be equal to:

.. code-block:: json

   {
    "my_list": [3, 1, 4],
    "unnamed": ["Hello, World!"]
   }

If we change the step 2 to:

.. code-block:: python

   """step-2"""
   import orchest

   data = [3, 1, 4]

   orchest.output(data, name=None)

The ``input_data`` in step 3 would be:

.. code-block:: json

   {
    "unnamed": ["Hello, World!", [3, 1, 4]]
   }

Populating the ``unnamed`` key with the all outputted values without a name.

.. _unnamed order:

Ordering unnamed data
~~~~~~~~~~~~~~~~~~~~~

The visual pipeline editor can order data passing. This is written to the pipeline definition file.
:meth:`orchest.transfer.get_inputs` then infers order from the pipeline definition file.

Below is a screenshot of step 3's properties from the example above. The list can be reordered with
drag and drop.

.. image:: ../img/step-connections.png
  :width: 300
  :align: center

Having the above order of connections, step 3's ``input_data`` becomes:

.. code-block:: json

   {
    "unnamed": [[3, 1, 4], "Hello, World!"]
   }

Top-to-bottom in the visual editor corresponds to left-to-right in ``unnamed``.
