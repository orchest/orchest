Python
======

Python package to pass data between pipeline steps in Orchest.

Since memory resources are scarce we have implemented a custom eviction manager for the store as
part of `Orchest <http://www.github.com/orchest/orchest>`_.  Without it, objects do not
get evicted from the store (even when an object has no reference) and will eventually lead to the
store reaching its maximum capacity with no room for new data.


Installation
------------
Currently the recommended method for installing the Orchest SDK is through the GitHub repository
using :code:`pip`

.. code-block:: bash

   # To get the latest release you can substitute "master" for "develop".
   pip install git+https://github.com/orchest/orchest-sdk.git@master#subdirectory=python


Quickstart
----------

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
