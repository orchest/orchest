Python
======

Python package to pass data between pipeline steps in the Orchest platform.

Since memory resources are scarce we have implemented a custom eviction manager for the store as
part of the `Orchest platform <http://www.github.com/orchest/orchest>`_.  Without it, objects do not
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
