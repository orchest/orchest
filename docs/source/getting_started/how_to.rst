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

WIP.

``utils.py`` module for example inside the project.

Minimalize Orchest's disk size
------------------------------
WIP

Use a GPU in Orchest
--------------------
WIP

Use the pipeline editor like a pro
----------------------------------
* Hold down ``<Space>`` inside the pipeline editor to drag the canvas (similar to design tools such
  as Sketch).
* To select a specific selection of pipeline steps: hold ``<Ctrl>`` and click on  pipeline steps you
  want to select.

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

.. _self-host orchest:

Self-host Orchest
-----------------
Running Orchest on a cloud hosted VM (such as EC2) does not require a special installation. Simply
follow the :ref:`regular installation process <regular installation>`.

To enable SSL you first need to get the SSL certificates for your domain and put the certificates in
the correct place so that Orchest recognizes them. This can be done using a convenience script:

.. code-block:: sh

    scripts/letsencrypt-nginx.sh <domain> <email>

Make sure to start Orchest on port ``80`` so that HTTP requests can automatically be upgraded to
HTTPS:

.. code-block:: bash

   ./orchest start --port=80

.. tip::
   👉 Refer to the :ref:`authentication section <authentication>` to enable the authentication.
