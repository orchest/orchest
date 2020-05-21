Python
======

Python package to pass data between pipeline steps in the Orchest platform.

Installation
------------
Currently the recommended method for installing the Orchest SDK is through the :code:`git`
repository using :code:`pip`

.. code-block:: bash

   pip install git+https://github.com/orchest/orchest-sdk.git#subdirectory=python


Quickstart
----------
Example for sending through disk, where `Step 1` -> `Step 2`.

.. code-block:: python

   """Step 1"""
   from orchest import transfer

   data = [1, 2, 3]

   # Note that you do not need to specify what step you want to send the
   # data to. This is managed through your pipeline definition.
   transfer.send_to_disk(data)


.. code-block:: python

   """Step 2"""
   from orchest import transfer

   # Now we will get: data = [1, 2, 3]
   data = transfer.receive_from_disk()


API guide
---------

orchest.transfer
~~~~~~~~~~~~~~~~

.. automodule:: orchest.transfer
    :members:
