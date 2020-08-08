.. _sdk:

Data passing SDK
================

`API documentation of the Orchest SDK <https://orchest-sdk.readthedocs.io/en/latest/>`_.

Orchest SDK for interacting with Orchest. What you can do using the SDK:

* Data passing between pipeline steps. It manages the target and source of the data, leaving the
  user only with the decision what data to pass. The target and source of the data are inferred
  through the defined pipeline definition in Orchest (the `pipeline.json` file).
* Interacting with data sources, such as your regular MySQL databases but also Amazon S3 buckets.
* Using the parametrized values of pipeline steps and updating them.

We plan to also support other popular programming languages such as R.


Installation
------------
.. note::
   The SDK comes pre-installed when using it in Orchest.


Quickstart
----------
Code examples are given in Python. For other programming languages please refer to the
`API documentation of the Orchest SDK <https://orchest-sdk.readthedocs.io/en/latest/>`_.

Data passing
~~~~~~~~~~~~

For this example we let the pipeline (defined inside the :code:`pipeline.json`) be as follows: 

.. image:: img/pipeline.png
  :width: 400
  :alt: Pipeline defined as: step-1, step-2 --> step-3
  :align: center

where the order of getting data by `step-3` is [`step-2`, `step-1`].

.. note:: The order in which the data is retrieved in `step-3` is determined via the UI through the
   `Connections` section in the pipeline step properties pane. Order is from top to bottom, where
   the first element in the list (returned by ``get_inputs``) is the output of the top most step 
   from the `Connections`.


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


Parameters
~~~~~~~~~~
.. code-block:: python

   """Step 1"""
   import orchest

   # Get the parameters of the current step.
   params = orchest.get_params()  # params = {'vegetable': 'carrot'}

   # Add a new parameter and update the step's parameters.
   params['fruit'] = 'apple'
   orchest.update_params(params)


Datasources
~~~~~~~~~~~
.. code-block:: python

   import orchest
   import pandas as pd

   # Note that the "example-mysql-db" is created in the UI first under
   # "Datasources" in the left hand panel.
   mysql = orchest.get_datasource('example-mysql-db')

   # Use a connection object to execute an SQL query.
   with mysql.connect() as conn:
      df = pd.read_sql('SELECT * FROM users', conn)

