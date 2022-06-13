.. _environments:

Environments
============

Environments define the conditions in which Pipeline Steps execute scripts and kernels. Environments are:

* Chosen in the Pipeline Step properties panel in the Pipeline Editor.
* Configurable through their set-up script (on the Environments page) to install additional packages.
* Versioned and belong to a single Project.

.. _languages:

Choosing a programming language
-------------------------------

An Environment only uses one programming language to avoid bloating its container image with too many dependencies. Orchest has built in support for environments with the languages:

* Python
* R
* JavaScript
* Julia

Each environment supports ``Bash`` scripts to invoke any other language indirectly. For example: ``Java``, ``Scala``, ``Go`` or ``C++``.

Building an Environment
-----------------------
1. Go to the *Environments* page.
2. Create a new *Environment*.
3. Choose an *Environment name*.
4. Choose a base image.
5. Choose one of the supported languages.
6. Add installation commands for additional packages in the *Environment set-up script*. For example: :code:`pip install tensorflow`
   or :code:`sudo apt-get install gcc`.
7. Press the *Build* button.

Updated Environments will automatically be used in the Pipeline editor and :term:`interactive pipeline runs <interactive (pipeline) run>`.

Important Environment Paths
---------------------------
Executed code can access important Environment paths:

``/data``
    Use this directory to write large artifacts and/or data to. Writing to other locations might result in data loss (since the Environments are stateless) or bloat your Project directory (which slows down :ref:`job <jobs>`).

``/project-dir``
    This directory contains all files from your :ref:`project <projects>` and is the working directory when building the environment. This means that you can:

    .. code-block:: bash

       #!/bin/bash
       pip install -r requirements.txt

.. _install packages:

Installing additional packages
------------------------------

.. tip::
    👉 See video tutorial: `installing additional packages <https://app.tella.tv/story/cknr8owf4000308kzalsk11a5>`_.

Example *Environment set-up script*:

.. code-block:: bash

   #!/bin/bash

   # Get system level dependencies for one of your packages
   sudo apt-get install -y default-libmysqlclient-dev

   # Install any dependency using mamba or conda
   mamba install -y spacy -c conda-forge

   # Or, alternatively, install Python dependencies using pip
   pip install black

Installing packages with ``conda`` is also supported but might take longer (due to known conda issues regarding dependency solving). We recommmend using `mamba <https://mamba.readthedocs.io/>`_ as a user-friendly and fast drop-in conda replacement. ``pip``, ``mamba`` and ``conda`` caches are persisted across builds for quicker iterations. This cache can be ignored or removed using the respective flags (e.g. ``pip install --no-cache``) or commands.

.. warning::
   🚨 Do not install packages by running :code:`!pip install <package-name>` inside your Jupyter Notebook. This causes the package to be installed every time you run the Pipeline Step. It is not saved in the Environment as containers are stateless!

Custom Environment images
-------------------------

Fully custom environment images are not recommended. This is because Environments require a particular image structure to cater for Jupyter Docker stacks dependencies, Pipeline runs and hosting active Jupyter kernels. Instead, use our default base images and customize them via the *set-up script*.

Using a different Python version
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

To use a different Python version:

1. Create the new conda Environment in your setup script with the desired Python version.
2. Store the relevant environment variables in ``/home/jovyan/.orchestrc`` which will be sourced on startup.

For example, configuring an Environment with Python 3.10 using mamba:

.. code-block:: bash

   #!/bin/bash
   # Install Python 3.10 and get minimum set of dependencies
   mamba create -y -n py310 python=3.10 future
   mamba install -y -n py310 ipykernel jupyter_client ipython_genutils pycryptodomex future "pyarrow<8.0.0"
   mamba run -n py310 pip install orchest

   # Jupyter environment variable that specifies
   # a path to search for kernels data files
   # See https://jupyter-core.readthedocs.io/en/latest/paths.html
   echo "export JUPYTER_PATH=/opt/conda/envs/py310/share/jupyter" >> /home/jovyan/.orchestrc

   # Orchest related environment variable that can be set to specify
   # the conda environment to use to start Jupyter kernels
   echo "export CONDA_ENV=py310" >> /home/jovyan/.orchestrc
