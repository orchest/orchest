Other
=====

.. TODO
   Pretty much this entire section

Orchest workflow
----------------
Make sure to put data in `/data` or some other data source, otherwise it will be copied for
experiments.

.. _configuration:

Configuration
-------------

.. How to enable eviction and some info:
   Since memory resources are scarce we have implemented a custom eviction manager when passing data
   through memory.  Without it, objects do not get evicted from memory
   (even when an object has no reference) which will eventually lead to the memory reaching its
   maximum capacity leaving no room for new data.


.. _authentication:

Authentication
--------------

Tips and tricks
---------------
* Hold down ``<Space>`` inside the pipeline editor to drag the canvas (similar to design tools such
  as Sketch).
* On your host machine, in the terminal, run :code:`docker ps -f network=orchest` to see all the
  containers that Orchest is running.
