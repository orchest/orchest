.. _configuration:

Configuration
=============

Orchest settings
----------------
Orchest stores a global configuration file at ``~/.config/orchest/config.json`` (or at
``$XDG_CONFIG_HOME/orchest/config.json`` if defined). The content of the file can be changed from
within in the UI through *Settings*.

Example content:

.. code-block:: json

   {
     "AUTH_ENABLED": false,
     "MAX_JOB_RUNS_PARALLELISM": 4,
     "MAX_INTERACTIVE_RUNS_PARALLELISM": 4,
     "TELEMETRY_DISABLED": false,
     "TELEMETRY_UUID": "69b40767-e315-4953-8a2b-355833e344b8"
   }

Explanation of possible configuration settings:

``AUTH_ENABLED``
    Enable authentication, see :ref:`authentication <authentication>`.

``MAX_JOB_RUNS_PARALLELISM``
    Controls the level of parallelism of job runs. By default, only one run at a time will be
    executed, across all jobs. You need to restart Orchest for this change to take effect. Has to be
    in the range of ``[1, 25]``.

``MAX_INTERACTIVE_RUNS_PARALLELISM``
    Controls the level of parallelism of interactive runs of different pipelines (by definition only
    one interactive run can be running for a particular pipeline at a given time). For example, by
    setting this value to ``2`` you can (interactively) run two different pipelines (through the
    pipeline editor) at the same time. You need to restart Orchest for changes to take effect. Has
    to be in the range of ``[1, 25]``.

``TELEMETRY_DISABLED``
    Option to disable telemetry completely.

``TELEMETRY_UUID``
    UUID to track usage across user sessions.

.. note::
   We do not use any third-party to track telemetry, see what telemetry we track and how in `our
   codebase
   <https://github.com/orchest/orchest/blob/master/services/orchest-webserver/app/app/analytics.py>`_.
   All telemetry is completely anonymized through your ``TELEMETRY_UUID``, and we do not store any

.. _authentication:

Authentication
~~~~~~~~~~~~~~
Before enabling authentication, make sure you have created user accounts through the settings pane
under *Manage users*.

To enable user authentication in Orchest the ``AUTH_ENABLED`` config option has to be set to
``true``. Please refer to the :ref:`configuration <configuration>` section above to read how.

.. note::
   Orchest does not yet support user sessions, meaning that there is no granularity or security
   between users. All you can do is have the same installation of Orchest be accessible by a
   configured set of users with corresponding passwords.  IP information either on our servers.

.. _pipeline settings:

Pipeline settings
-----------------
.. note::
   WIP: clearing the memory store

There are also configuration options per pipeline that can be set through the UI by opening a
pipeline and going to its *Settings* in the top right corner. This will add the following JSON block
to the corresponding pipeline definition:

.. code-block:: text

   "settings": {
     "auto_eviction": true,
     "data_passing_memory_size": "1GB"
   }

``auto_eviction``
    When sending data between pipeline steps through memory all the data is by default kept in
    memory, only overwriting an object if the same pipeline step passes data again. To free memory
    you can either *Clear memory* through the pipeline settings or enable auto eviction. Auto
    eviction will make sure objects are evicted once all depending steps have obtained the data.

    .. note::
       Auto eviction is always enabled for *jobs*.

``data_passing_memory_size``
    The size of the memory for data passing. All objects that are passed between steps are by
    default stored in memory (you can also explicitly use :meth:`orchest.transfer.output_to_disk`)
    and thus it is recommended to choose an appropriate size for your application. Values have to be
    strings formatted as floats with a unit of ``GB``, ``MB`` or ``KB``, e.g. ``"5.4GB"``.

Configuring JupyterLab
----------------------

Extensions
~~~~~~~~~~
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
~~~~~~~~~~~~~
User settings that are configured through the JupyterLab GUI, such as your *JupyterLab Theme* or
*Text Editor Key Map*, are persisted automatically. It just works.
