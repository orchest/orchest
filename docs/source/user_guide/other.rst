Other
=====

.. _configuration:

Configuration
-------------

.. TODO(yannick)
   Put this section back once we have the "Pipeline level configurations" section
.. Global configurations
.. ~~~~~~~~~~~~~~~~~~~~~

Orchest stores a global configuration file at ``~/.config/orchest/config.json`` (trying to adhere to
``XDG_CONFIG_HOME``). The content of the file can be changed from within in the UI through *Settings*.

Example content:

.. code-block:: json

   {
     "TELEMETRY_UUID": "69b40767-e315-4953-8a2b-355833e344b8",
     "TELEMETRY_DISABLED": false,
     "AUTH_ENABLED": false
   }

Explanation of possible configuration settings:

* ``TELEMETRY_UUID``. UUID to track usage across user sessions.
* ``TELEMETRY_DISABLED``. Option to disable telemetry completely.
* ``AUTH_ENABLED``. Enable authentication, see :ref:`authentication <authentication>`.

.. note::
   We do not use any third-party to track telemetry, see what telemetry we track and how in `our
   codebase
   <https://github.com/orchest/orchest/blob/master/services/orchest-webserver/app/app/analytics.py>`_.
   All telemetry is completely anonymized through your ``TELEMETRY_UUID``, and we do not store any
   IP information either on our servers.

.. Pipeline level configurations
.. ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
.. TODO(yannick)
   * We first need to add eviction setting through the UI
   How to enable eviction and some info:
   Since memory resources are scarce we have implemented a custom eviction manager when passing data
   through memory.  Without it, objects do not get evicted from memory
   (even when an object has no reference) which will eventually lead to the memory reaching its
   maximum capacity leaving no room for new data.

.. _authentication:

Authentication
--------------
Before enabling authentication, make sure you have created user accounts through the settings pane
under *Manage users*.

To enable user authentication in Orchest the ``AUTH_ENABLED`` config option has to be set to
``true``. Please refer to the :ref:`configuration <configuration>` section above to read how.

Skipping notebook cells
-----------------------
Notebooks facilitate an experimental workflow, meaning that there will be cells that should not be
run when executing the notebook (from top to bottom). Since :ref:`pipeline runs <pipeline run>`
require your notebooks to be executable Orchest provides an (already installed JupyterLab) extension
to skip those cells.

To skip a cell during pipeline runs:

1. Open JupyterLab.
2. Go to the *Property Inspector*, this is the icon with the two gears all the way at the right.
3. Select the cell you want to skip and give it a tag of: *skip*.

The cells with the *skip* tag are still runnable through JupyterLab, but when executing these
notebooks as part of pipelines in Orchest they will not be run.

Tips and tricks
---------------
* Hold down ``<Space>`` inside the pipeline editor to drag the canvas (similar to design tools such
  as Sketch).
* On your host machine, in the terminal, run :code:`docker ps -f network=orchest` to see all the
  containers that Orchest is running.
