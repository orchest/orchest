Configuring JupyterLab
======================

Extensions
----------

You can install JupyterLab extensions through the JupyterLab GUI directly, these extensions will be
persisted (across :ref:`interactive sessions <interactive session>`) automatically.

JupyterLab also supports server extensions. To install these extensions, navigate to *Settings* >
*Configure JupyterLab*. Here you can install extensions like you normally would using commands such
as:

.. code-block:: bash

   pip install jupyterlab-git

In addition, you can install extensions from :code:`npm` through the :code:`jupyter` command.

.. code-block:: bash

   jupyter labextension install jupyterlab-spreadsheet

.. note::

   To build the JupyterLab image you need to make sure there are no interactive sessions running.

User settings
-------------

User settings that are configured through the JupyterLab GUI, such as your *JupyterLab Theme* or
*Text Editor Key Map*, are persisted automatically. It just works.
