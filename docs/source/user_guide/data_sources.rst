.. _data sources:

Data sources
============

It is common for data to be stored elsewhere and to connect to those data sources from within your
scripts. To make sure that all the secrets can be managed seperately, they are stored in a central
place.

Get started with data sources by configuring one through the *Data sources* option in the left pane
menu.

1. Click on *Data sources* in the left menu pane.
2. Click on the "+" sign to add a data source.
3. Specify a "Name" and "Data source type".
4. Put in the "Connection details" to connect to the data source. For example for a MySQL database,
   you'd have to specify the "Host", "Database name", "Username" and "Password".
5. Lastly, press *Save*.

Next, see :ref:`sdk-quickstart-data-sources` in the SDK section to get started with data sources
from within your scripts.

.. note::
   For full reproducibility of your experiments, Orchest creates a snapshot of your active pipeline
   directory. Therefore it is recommended to never write large amounts of data to your pipeline
   directory but to use the *Filesystem directory* data source type instead. It is nothing more than
   a special path that gets mounted for the purpose of storing large amounts of data.


.. Might be good to state what data sources are supported (per language in the SDK). But I do want
   to mention it here and not in the SDK
