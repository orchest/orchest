Orientation
===========

Orchest concepts
----------------

.. TODO(yannick)
   Pretty much this entire section

.. * Build on top of filesystem and what that means for interactive runs and experiments (this will
..   copy the filesystem, read more in ... link)
   * Files run inside images and images can be extended through environments.
.. * Environments
.. * Projects and Pipelines

Coming soon!

How Orchest works
-----------------

Orchest is a fully containerized application and its runtime can be managed through the ``orchest``
shell script. In the script you can see that the Docker socket ``/var/run/docker.sock`` is mounted,
which Orchest requires in order order to dynamically spawn Docker containers when running pipelines.
Global configurations are stored at ``~/.config/orchest/config.json``, for possible configuration
values see :ref:`configuration <configuration>`.

.. build on top of your filesystem (giving you the flexibility to edit the files in whatever way you
   like, through terminal, your editor or through our UI with deep Jupyter integration). You do need
   to follow a certain directory structure.
   projects and pipelines and environments(link to section)

Orchest is powered by your filesystem, there is no hidden magic. Upon launching, Orchest will mount
the content of the ``orchest/userdir/`` directory, where ``orchest/`` is the install directory from
GitHub, in the Docker containers. Giving you access to your scripts from within Orchest, but also
allowing you to structure and edit the files with any other editor such as VS Code!

.. note::
   The ``userdir/`` directory not only contains your files and scripts, it also contains the state
   (inside the ``userdir/.orchest/`` directory) that Orchest needs to run. Touching the state can
   result in, for example, losing experiment entries causing them to no longer show up in the UI.

The mental model in Orchest is centered around *Projects*. Within each project you get to create
multiple :ref:`pipelines <pipeline>` through the Orchest UI, and every pipeline consists of
:ref:`pipeline steps <pipeline step>` that point to your scripts. Let's take a look at the
following directory structure of a project:

.. code-block:: bash

    myproject
        ├── .orchest
        │   ├── data/
        │   ├── logs/
        │   └── environments/
        ├── pipeline.orchest
        ├── prep.ipynb
        └── training.py

.. note::
   Again Orchest creates a ``.orchest/`` directory to store state. In the ``.orchest/data/``
   directory the passed data between steps is stored, if disk based data passing is used instead of
   (the default) memory data passing, see :ref:`data passing <data passing>`. The ``.orchest/logs/``
   directory contains the STDOUT of the scripts and can be inspected through the Orchest UI.

.. warning::
   You should not put large files inside your project and instead use :ref:`data sources <data
   sources>` or write to the special ``/data`` directory (which is the mounted ``userdir/data/``
   directory that is shared between projects). :ref:`Experiments <experiments>` create snapshots of
   the project directory (for reproducibility reasons) and therefore would copy all the data.

The :ref:`pipeline definition <pipeline definition>` file ``pipeline.orchest`` above defines the
structure of the pipeline. For example:

.. image:: ../img/pipeline-orientation.png
  :width: 400
  :alt: Pipeline defined as: prep.ipynb --> training.py
  :align: center

As you can see the pipeline steps point to the corresponding files: ``prep.ipynb`` and
``training.py``. These files are run inside their own isolated environments (as defined in
``.orchest/environments/``) using containerization.  In order to install additional packages or to
easily change the Docker image, see :ref:`environments <environments>`.

.. note::
   We currently only support Python and R.
