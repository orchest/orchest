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
Currently the recommended method for installing the Orchest SDK is through the GitHub repository
using :code:`pip`

.. code-block:: bash

   # To get the latest release you can substitute "master" for "develop".
   pip install git+https://github.com/orchest/orchest-sdk.git@master#subdirectory=python


Code example
~~~~~~~~~~~~
Example for sending through disk, where `Step 1` -> `Step 2`.

.. code-block:: python

   """Step 1"""
   from orchest import transfer

   data = [1, 2, 3]

   # Note that you do not need to specify what step you want to send the
   # data to. This is managed through your pipeline definition.
   transfer.send_disk(data)


.. code-block:: python

   """Step 2"""
   from orchest import transfer

   # Now we will get: data = [[1, 2, 3]]
   data = transfer.receive()
