Other
=====

.. _configuration:

Configuration
-------------

Global configurations
~~~~~~~~~~~~~~~~~~~~~

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

``TELEMETRY_UUID``
    UUID to track usage across user sessions.
``TELEMETRY_DISABLED``
    Option to disable telemetry completely.

``AUTH_ENABLED``
    Enable authentication, see :ref:`authentication <authentication>`.

.. note::
   We do not use any third-party to track telemetry, see what telemetry we track and how in `our
   codebase
   <https://github.com/orchest/orchest/blob/master/services/orchest-webserver/app/app/analytics.py>`_.
   All telemetry is completely anonymized through your ``TELEMETRY_UUID``, and we do not store any
   IP information either on our servers.

.. _pipeline configuration:

Pipeline level configurations
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
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

``data_passing_memory_size``
    The size of the memory for data passing. All objects that are passed between steps are by
    default stored in memory (you can also explicitly use :meth:`orchest.transfer.output_to_disk`)
    and thus it is recommended to choose an appropriate size for you application. Values have to be
    strings formatted as floats with a unit of ``GB``, ``MB`` or ``KB``, e.g. ``"5.4GB"``.


.. _authentication:

Authentication
--------------
Before enabling authentication, make sure you have created user accounts through the settings pane
under *Manage users*.

To enable user authentication in Orchest the ``AUTH_ENABLED`` config option has to be set to
``true``. Please refer to the :ref:`configuration <configuration>` section above to read how.

.. note::
   Orchest does not yet support user sessions, meaning that there is no granularity or security
   between users. All you can do is have the same installation of Orchest be accessible by a
   configured set of users (with passwords of course).

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
* To select a specific selection of pipeline steps: hold ``<Ctrl>`` and click on  pipeline steps you
  want to select.
* On your host machine, in the terminal, run :code:`docker ps -f network=orchest` to see all the
  containers that Orchest is running.

Docker networking
-----------------

If you need to connect to your host machine from within Orchest you can use 
:code:`host.docker.internal` as the hostname to point to services running on 
your host (i.e. point to :code:`127.0.0.1` on your host).

You can read more  about this networking feature on the 
`Docker website <https://docs.docker.com/docker-for-windows/networking/#use-cases-and-workarounds>`_.

For this to work in Linux you need to have the latest version of Docker installed. More information about support can be found 
in this `thread on GitHub <https://github.com/docker/for-linux/issues/264#issuecomment-714253414>`_.

.. note::
  This is helpful when, for example, connecting to a local `Postgres <https://www.postgresql.org/>`_ database. Make sure your
  service listens on the right interfaces. For Postgres you can refer to `this Stack Overflow post 
  <https://stackoverflow.com/questions/3278379/how-to-configure-postgresql-to-accept-all-incoming-connections>`_ to learn 
  how to configure Postgres to listen on all network interfaces so you can connect from within containers.
