Orchest SDK
===========

`Website <https://www.orchest.io>`_
-- `GitHub <http://www.github.com/orchest/orchest-sdk>`_
-- `Gitter <http://www.gitter.im/orchest>`_

Orchest SDK can be used to pass data between pipeline steps in the Orchest platform. The SDK
manages the destination and source of the data, giving the user an easy to use API.


Python
------
.. We also want auto generated docs.

Python package to pass data between pipeline steps in the Orchest platform.

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
