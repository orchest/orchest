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

   # Note that you do not need to specify what step you want to output
   # the data to. This is managed through your pipeline definition.
   transfer.output_to_disk(data)

   # Alternatively, you can also output the data to memory.
   # transfer.output_to_memory(data)


.. code-block:: python

   """Step 2"""
   from orchest import transfer

   # You will receive the same data, regardless of the output method 
   # used in Step 1. 
   data = transfer.get_inputs()  # data = [[1, 2, 3]]


API
---

orchest.transfer
~~~~~~~~~~~~~~~~

.. automodule:: orchest.transfer
    :members:
