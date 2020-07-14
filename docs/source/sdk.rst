.. _sdk:

Data passing SDK
================

Full documentation of the Orchest SDK can be found here: `orchest-sdk <https://orchest-sdk.readthedocs.io/en/latest/>`_.

Orchest SDK for data passing between pipeline steps in the Orchest platform. The SDK manages the
destination and source of the data, leaving the user only with the decision what data to send
(because receiving automatically retrieves all the sent data).

The destination and source of the data are inferred through the defined pipeline definition in the
platform (the `pipeline.json` file).

We plan to also support other popular programming languages such as R.

Python SDK
----------
Python package to pass data between pipeline steps in the Orchest platform.

Installation
~~~~~~~~~~~~
.. note::
   The SDK comes pre-installed when using the Orchest platform.

Currently the recommended method for installing the Orchest SDK is through the GitHub repository
using :code:`pip`

.. code-block:: bash

   # To get the latest release you can substitute "master" for "develop".
   pip install git+https://github.com/orchest/orchest-sdk.git@master#subdirectory=python


Code example
~~~~~~~~~~~~
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
