.. _configuration:

Configuration
=============

.. _orchest settings:

Orchest settings
----------------
Orchest is configured through a number of settings that can be changed from within the UI through
*Settings*. Some settings will require Orchest to be restarted for changes to take effect.

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
    Possible values: ``true`` or ``false``.

    Enables authentication. When enabled, Orchest will require you to login through its login
    screen. Make sure you have created user accounts through *settings* > *manage users*.

    .. note::
       💡 Orchest does not yet support user sessions, meaning that there is no granularity or
       security between users. All you can do is have the same installation of Orchest be accessible
       by a configured set of users with corresponding passwords.

``MAX_JOB_RUNS_PARALLELISM``
    Possible values: integer in the range of ``[1, 25]``.

    Controls the level of parallelism of job runs, defining how many pipelines of jobs can run
    concurrently. For example, you have 10 jobs that each runs 5 pipelines. If this setting is set
    to 3, then over all job only 3 pipeline runs can run in parallel.

``MAX_INTERACTIVE_RUNS_PARALLELISM``
    Possible values: integer in the range of ``[1, 25]``.

    Controls the level of parallelism of interactive runs of different pipelines (by definition only
    one :ref:`interactive run <interactive pipeline run>` can be running for a particular pipeline
    at a given time). For example, by setting this value to ``2`` you can (interactively) run two
    different pipelines (through the pipeline editor) at the same time. This setting can be useful
    when using Orchest with multiple people.

``TELEMETRY_DISABLED``
    Possible values: ``true`` or ``false``.

    Option to disable telemetry completely.

``TELEMETRY_UUID``
    UUID to track usage across user sessions.

    .. note::
       💡 We do not use any third-party to track telemetry, see what telemetry we track and how in
       `our codebase
       <https://github.com/orchest/orchest/blob/master/services/orchest-webserver/app/app/analytics.py>`_.
       All telemetry is completely anonymized through your ``TELEMETRY_UUID``, and we do not store
       any IP information either on our servers.

.. _configuration jupyterlab:

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
   💡 Building the JupyterLab image will stop all interactive sessions as they are still using the
   old JupyterLab image.

User settings
~~~~~~~~~~~~~
User settings that are configured through the JupyterLab GUI, such as your *JupyterLab Theme* or
*Text Editor Key Map*, are persisted automatically. No additional configuration needed.
