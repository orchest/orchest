SDK
===
[LINK TO DOCS OF THE SDK - this is just a general overview]

You can send data and receive data. The destination and source of the data is managed by this
package. For sending all you need to specify is the data you want to send and how to send it. For
receiving all you need to do is call the appropriate receive method depending on where you send the
data to in the previous step.

We plan to also support other popular programming languages such as R.

Python SDK
----------
Python package to pass data between pipeline steps in the Orchest platform.

Installation
~~~~~~~~~~~~
Installation info

Code example
~~~~~~~~~~~~
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
