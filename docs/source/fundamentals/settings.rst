.. _settings:

Settings
========

Orchest is configured through *Settings*. Some settings require Orchest to be restarted for changes to take effect. For example:

.. code-block:: json

   {
     "AUTH_ENABLED": false,
     "MAX_JOB_RUNS_PARALLELISM": 4,
     "MAX_INTERACTIVE_RUNS_PARALLELISM": 4,
     "TELEMETRY_DISABLED": false,
     "TELEMETRY_UUID": "69b40767-e315-4953-8a2b-355833e344b8"
   }

``AUTH_ENABLED``
    Boolean: ``true`` or ``false``.

    Enables authentication. When enabled, Orchest will require a login. Create user accounts through *settings* > *manage users*. Orchest does not yet support individual user sessions, meaning that there is no granularity or security between users.

``MAX_JOB_RUNS_PARALLELISM``
    Integer between: ``[1, 25]``.

    Controls the number of Job runs that can be run in parallel across all Jobs. For example, if this is set to 3, then only 3 Pipeline runs can run in parallel.

``MAX_INTERACTIVE_RUNS_PARALLELISM``
    Integer between: ``[1, 25]``.

    Controls the number of :ref:`interactive runs <interactive pipeline run>` that can be run in parallel for different Pipelines at a given time. For example, if this is set to ``2``, then only ``2`` different Pipelines can have interactive runs at the same time. This is useful when multiple users are using Orchest.

``TELEMETRY_DISABLED``
    Boolean: ``true`` or ``false``.

    Disables telemetry.

``TELEMETRY_UUID``
    UUID to track usage across user sessions.

    .. note::
       💡 We do not use any third-party to track telemetry, see what telemetry we track and how in
       `our codebase
       <https://github.com/orchest/orchest/blob/2fb57b8c6ed699fa5f6529a38b838a5670a91a97/services/orchest-webserver/app/app/analytics.py#L26-L53>`_.
       All telemetry is anonymized through the ``TELEMETRY_UUID``. We do not store any IP
       information on our servers.

.. _configuration jupyterlab:

Configuring JupyterLab
----------------------

Extensions
~~~~~~~~~~
You can install JupyterLab extensions through the JupyterLab UI and these extensions will persist (across :ref:`interactive sessions <interactive session>`) automatically.

JupyterLab also supports server extensions. To install, navigate to *Settings* > *Configure JupyterLab*. For example:

.. code-block:: bash

   pip install jupyterlab-git

You can also install extensions from :code:`npm` through the :code:`jupyter` command.

.. code-block:: bash

   jupyter labextension install jupyterlab-spreadsheet

.. note::
   💡 Building the JupyterLab image will stop all interactive sessions since they are still using the old JupyterLab image.

User settings
~~~~~~~~~~~~~

User settings that are configured through the JupyterLab GUI, such as your *JupyterLab Theme* or *Text Editor Key Map*, are persisted automatically. No additional configuration needed.
