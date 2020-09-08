Development
===========

Implementation details
----------------------
The :meth:`orchest.transfer.get_inputs` method calls :meth:`orchest.transfer.resolve` which, in
order to resolve what output data the user most likely wants to get, needs a timestamp of the most
recent output for every transfer type. E.g. if some step outputs to disk at 1pm and later outputs to
memory at 2pm, then it is very likely that output data should be retrieved from memory. Therefore,
we adhere to a certain "protocol" for transfers through disk and memory as can be read below.

Disk transfer
~~~~~~~~~~~~~
To be able to resolve the timestamp of the most recent write, we keep a file called ``HEAD`` for
every step. It has the following content: ``timestamp, serialization``, where timestamp is specified
in isoformat with timespec in seconds.


Memory transfer
~~~~~~~~~~~~~~~
When data is put inside the store it is given metadata stating either its serialization or (in case
of an empty message for eviction) the source and target of the output that is stored.

All metadata has to be in `bytes`, where we use the following encoding:

* ``1;serialization`` where serialization is one of ``['arrow', 'arrowpickle']``.
* ``2;source,target`` where source and target are both UUIDs of the respective steps.


Contributer guides
------------------
TBD
