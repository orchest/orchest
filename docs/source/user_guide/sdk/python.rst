Python
======

Quickstart
----------

.. _sdk-quickstart-data-passing:

Data passing
~~~~~~~~~~~~
The SDK manages the target and source of the data, leaving you
only with the decision what data to pass. The target and source of the data are inferred
through the :ref:`pipeline definition <pipeline definition>`.

For this example we let the pipeline be defined as follows: 

.. image:: ../../img/pipeline.png
  :width: 400
  :alt: Pipeline defined as: step-1, step-2 --> step-3
  :align: center

where the order of getting data by `step-3` is [`step-2`, `step-1`].

.. note:: The order in which the data is retrieved in `step-3` is determined via the UI through the
   `Connections` section in the pipeline step properties pane. Order is from top to bottom, where
   the left most element in the list (returned by :meth:`orchest.transfer.get_inputs`) is the output
   of the top most step from the `Connections`.


.. code-block:: python

   """step-1"""
   import orchest

   data = 'Hello, World!'

   # Output the data so that step-3 can retrieve it.
   orchest.output(data)


.. code-block:: python

   """step-2"""
   import orchest

   data = [3, 1, 4]

   # Output the data so that step-3 can retrieve it.
   orchest.output(data)


.. code-block:: python

   """step-3"""
   import orchest

   # Get the input for step-3, i.e. the output of step-1 and step-2.
   data = orchest.get_inputs()  # data = [[3, 1, 4], 'Hello, World!']

.. note:: 
   Memory eviction of objects is disabled by default, refer to :ref:`configuration <configuration>`
   to learn how to enable it.


.. _sdk-quickstart-parameters:

Parameters
~~~~~~~~~~
.. code-block:: python

   import orchest

   # Get the parameters of the current step.
   params = orchest.get_params()  # params = {'vegetable': 'carrot'}

   # Add a new parameter and update the step's parameters. The 
   # parameters now also become visible through the properties pane in
   # the UI when clicking on a pipeline step.
   params['fruit'] = 'apple'
   orchest.update_params(params)

.. note::
   Parameters are at the core of :ref:`experiments <experiments>`, giving a handle to try out
   different modeling ideas based on a set of variable inputs.


.. _sdk-quickstart-data-sources:

Data sources
~~~~~~~~~~~~
Before you can interact with data sources from within your scripts, you have to configure one
through the *Data sources* option in the left menu pane. For more see
:ref:`data sources <data sources>`.

.. code-block:: python

   import orchest
   import pandas as pd

   # Note that the "example-mysql-db" is created in the UI first under
   # "Data sources" in the left hand panel.
   mysql = orchest.get_datasource('example-mysql-db')

   # Use a connection object to execute an SQL query.
   with mysql.connect() as conn:
      df = pd.read_sql('SELECT * FROM users', conn)


API
---

orchest.transfer
~~~~~~~~~~~~~~~~

.. automodule:: orchest.transfer
    :members:


orchest.parameters
~~~~~~~~~~~~~~~~~~

.. automodule:: orchest.parameters
    :members:


orchest.datasources
~~~~~~~~~~~~~~~~~~~

.. automodule:: orchest.datasources
    :members:
    :inherited-members:
