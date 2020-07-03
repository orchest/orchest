Python
======

Python package to pass data between pipeline steps in the Orchest platform.

Installation
------------
Currently the recommended method for installing the Orchest SDK is through the GitHub repository
using :code:`pip`

.. code-block:: bash

   # To get the latest release you can substitute "master" for "develop".
   pip install git+https://github.com/orchest/orchest-sdk.git@master#subdirectory=python


Quickstart
----------
Example of passing data, where the pipeline (defined inside the :code:`pipeline.json`) is 
`Step 1` -> `Step 2`.

.. code-block:: python

   """Step 1"""
   from orchest import transfer

   data = [1, 2, 3]

   # Output the data so that Step 2 can retrieve it.
   transfer.output(data)


.. code-block:: python

   """Step 2"""
   from orchest import transfer

   # Get the input for Step 2, i.e. the output of Step 1.
   data = transfer.get_inputs()  # data = [[1, 2, 3]]


API
---

orchest.transfer
~~~~~~~~~~~~~~~~

.. automodule:: orchest.transfer
    :members:
