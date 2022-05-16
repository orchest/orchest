How to...
=========

Pass data between pipeline steps
--------------------------------
Please refer to the dedicated section on :ref:`data passing <data passing>`.

Install new packages
--------------------
.. tip::
    👉 Would you rather watch a short video tutorial? Check it our here: `installing additional
    packages <https://app.tella.tv/story/cknr8owf4000308kzalsk11a5>`_.

To install new packages, you should make use of :ref:`environments <environments>`. Simply build a
new environment that contains your package and select it inside the pipeline editor. Installing
packages is done using well known commands such as ``pip install`` and ``sudo apt-get install``.

.. note::
   💡 When updating an existing environment, the new environment will automatically be used inside
   the visual editor (and for your :ref:`interactive pipeline runs <interactive pipeline run>`).
   However, the JupyterLab kernel needs to be restarted if it was already running.

What not to do
~~~~~~~~~~~~~~
Do **not** install new packages by running bash commands inside the Notebooks. This will require the
packages to be installed every time you do a pipeline run, since the state of the kernel environment
is ephemeral.

Use ``git`` inside Orchest
--------------------------
Please refer to the dedicated section on :ref:`using git inside Orchest <git inside Orchest>`.

.. _how to import a project:

Import a project
----------------
Check out our video: `importing a project
<https://www.tella.tv/video/cknr7of9c000409jr5gx4efjy/view>`_.

Share code between steps
------------------------
.. note::
   💡 This approach also works to share code between pipelines.

There are multiple answers to this question. One being that you can make that code into a package
which you can then install in your environment, just like other packages such as ``numpy``. Of
course the development cycle would be highly reduced with this approach and so an alternative would
be to add the files to the project directory directly and import them in your scripts.

For example, you could create a ``utils.py`` file in your project directory and use its functions
from within your scripts by:

.. code-block:: python

   import utils

   utils.transform(...)

Minimize Orchest's disk size
----------------------------
To keep Orchest's disk footprint to a minimal you can use the following best practices:

* Are you persisting data to disk? Then write it to the ``/data`` directory instead of the project
  directory. :ref:`Jobs <jobs>` create a snapshot (for reproducibility reasons) of your project
  directory and would copy data in your project directory for every pipeline run, consuming large
  amounts of storage. The smaller the size of your project directory, the smaller the size of your
  jobs.
* Do you have many pipeline runs as part of jobs? You can configure your job to only retain a
  number of pipeline runs and automatically delete the older ones. Steps: (1) edit an existing job
  or create a new one, (2) go to *pipeline runs*, and (3) select *auto clean-up*.

Use a GPU in Orchest
--------------------
Currently GPU support is not yet available. Coming soon!

Use the Orchest CLI
-------------------
Below you will find the most important ``orchest-cli`` commands that you need to know (you can also get all this
information by running ``orchest -h``):

.. code-block:: sh

   orchest start

   # Stop Orchest (shuts down Orchest completely).
   orchest stop

   # Install Orchest (check out the dedicated `Installation` guide in
   # the `Getting started` section).
   orchest install

   # Update Orchest to a newer version (NOTE: this can also be done
   # through the settings in the UI).
   orchest update

   # Get extensive version information. Useful to see whether the
   # installation was successful.
   orchest version


Use Orchest shortcuts like a pro
--------------------------------

Command palette
~~~~~~~~~~~~~~~
.. list-table::
   :widths: 25 25
   :header-rows: 1
   :align: left

   * - Key(s)
     - Action

   * - :kbd:`Control`/:kbd:`Command` + :kbd:`K`
     - Open command palette

   * - :kbd:`↑`/:kbd:`↓`
     - Navigate command palette commands

   * - :kbd:`PageUp`/:kbd:`PageDown`
     - Navigate command palette commands

   * - :kbd:`Escape`
     - Dismiss command palette

Pipeline editor
~~~~~~~~~~~~~~~
.. list-table::
   :widths: 25 25
   :header-rows: 1
   :align: left

   * - Key(s)
     - Action

   * - :kbd:`Space` + click + drag
     - Pan canvas*

   * - :kbd:`Ctrl` + click
     - Select multiple steps

   * - :kbd:`Ctrl` + :kbd:`A`
     - Select all steps*

   * - :kbd:`Ctrl` + :kbd:`Enter`
     - Run selected steps*

   * - :kbd:`H`
     - Center view and reset zoom

   * - :kbd:`Escape`
     - Deselect steps

   * - :kbd:`Delete`/:kbd:`Backspace`
     - Delete selected step(s)

   * - Double click a step
     - Open file in JupyterLab

\* Requires mouse to hover the canvas

.. _skip notebook cells:

Skip notebook cells
-------------------
Notebooks facilitate an experimental workflow, meaning that there will be cells that should not be
run when executing the notebook (from top to bottom). Since :ref:`pipeline runs <pipeline run>`
require your notebooks to be executable, Orchest provides an (pre-installed JupyterLab) extension
to skip those cells.

To skip a cell during pipeline runs:

1. Open JupyterLab.
2. Go to the *Property Inspector*, this is the icon with the two gears all the way at the right.
3. Select the cell you want to skip and give it a tag of: *skip*.

The cells with the *skip* tag are still runnable through JupyterLab, but when executing these
notebooks as part of pipelines in Orchest they will not be run.
