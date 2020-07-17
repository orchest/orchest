.. _sdk:

Data passing SDK
================

`API documentation of the Orchest SDK <https://orchest-sdk.readthedocs.io/en/latest/>`_.

Orchest SDK for data passing between pipeline steps in the Orchest platform. The SDK manages the
destination and source of the data, leaving the user only with the decision what data to send
(because receiving automatically retrieves all the sent data).

The destination and source of the data are inferred through the defined pipeline definition in the
platform (the `pipeline.json` file).

We plan to also support other popular programming languages such as R.


Installation
------------
.. note::
   The SDK comes pre-installed when using the Orchest platform.


Quickstart
----------
Code examples are given in Python. For other programming languages please refer to the
`API documentation of the Orchest SDK <https://orchest-sdk.readthedocs.io/en/latest/>`_.

Data passing
~~~~~~~~~~~~
Example of passing data, where the pipeline (defined inside the :code:`pipeline.json`) is 
`Step 1` -> `Step 2`.

.. code-block:: python

   """Step 1"""
   import orchest

   data = [1, 2, 3]

   # Output the data so that Step 2 can retrieve it.
   orchest.output(data)


.. code-block:: python

   """Step 2"""
   import orchest

   # Get the input for Step 2, i.e. the output of Step 1.
   data = orchest.get_inputs()  # data = [[1, 2, 3]]


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

