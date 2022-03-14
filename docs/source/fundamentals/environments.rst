.. _environments:

Environments
============
.. tip::
    👉 Would you rather watch a short video tutorial? Check it our here: `installing additional
    packages <https://app.tella.tv/story/cknr8owf4000308kzalsk11a5>`_.

The scripts and Notebooks that are pointed to by pipeline steps are executed within their own
environment when doing a pipeline run. When editing Notebooks, the respective kernel runs within an
environment as well! On step creation (or when editing the step) you can choose the environment it
should use.

Essentially, Orchest's environments define the execution environment in which the scripts and
kernels are executed. Therefore, if you want to use additional packages within scripts, then they
need to be installed in their respective environment.

Lastly, environments are part of a single project and included when versioning. This ensures that
you can get started immediately when importing an existing project without having to recreate the
same environment.

Important paths inside environments
-----------------------------------
Whenever code is executed in an environment a number of paths are mounted to the container that you
can access from within your code. These paths are:

``/data``
    This directory should be used to write large artifacts and/or data to. Writing it to other
    locations might lose your data (since the environments are stateless) or bloat your project
    directory (which will slow down :ref:`job <jobs>` creation).

``/project-dir``
    This directory contains all files from your :ref:`project <projects>`.

Building an environment
-----------------------
1. Go to *Environments* in the left menu pane.
2. Create a new *Environment*.
3. Choose an *Environment name*.
4. Choose a base image. This image will be extended through your setup bash script.
5. To keep environment image sizes to a minimal, each environment is tied to a specific programming
   language. Choose one of the supported languages for your environment.
6. Go to the *BUILD* tab to install additional packages by adding their installation steps to the *Environment set-up
   script*. This is where you enter your installation commands, e.g. :code:`pip install tensorflow`
   or :code:`sudo apt-get install gcc`.
7. Finally, press the *Build* button at the bottom.

.. note::
   💡 When updating an existing environment, the new environment will automatically be used inside
   the visual editor (and for your :ref:`interactive pipeline runs <interactive pipeline run>`).

.. _install packages:

Installing additional packages
------------------------------
.. warning::
   🚨 Do not install packages by running :code:`!pip install <package-name>` inside your
   Jupyter Notebook. This causes the package to be installed every time you run the pipeline
   step. It is not saved in the environment as containers are stateless!

Installing additional packages is as easy as building a new version of your environment that
includes the packages you need, simply follow the steps in the previous section. An example
*Environment set-up script*:

.. code-block:: bash

   #!/bin/bash

   # Get system level dependencies for one of your packages
   sudo apt-get install -y default-libmysqlclient-dev

   # Install a Python dependency using pip
   pip install tensorflow

   # Or, alternatively, install any dependency using conda
   conda install -y spacy -c conda-forge

.. note::
   💡 The environments Orchest provides are based on the  `Jupyter Docker Stacks
   <https://jupyter-docker-stacks.readthedocs.io/en/latest/>`_ and come with a number of
   `pre-installed packages
   <https://jupyter-docker-stacks.readthedocs.io/en/latest/using/selecting.html>`_. However, the
   JupyterLab kernel needs to be restarted if it was already running.

.. warning::
   🚨 Installing packages with conda is supported, but conda might need a long time to solve
   the environment. To reduce this time, try pinning the exact versions of the packages you want,
   or install `mamba <https://mamba.readthedocs.io/>`_ as a faster drop-in replacement to conda.

Installing packages from a ``requirements.txt``
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
The *environment set-up script* is run inside the ``/project-dir``, meaning that you can directly
interact with your project files from within the script. For example:

.. code-block:: bash

   #!/bin/bash
   pip install -r requirements.txt

Creating a custom environment image
-----------------------------------
Bringing your own fully custom environment image is not recommended as Orchest requires a certain
structure of the image to work correctly. Due to the dependency on the Jupyter Docker stacks and the
ability of the environments to work for pipeline runs and to host active Jupyter kernels, we
recommend using :ref:`environments <environments>` instead and using its *set-up script* instead to
customize it further.

Using a different Python version
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
It might be the case that your code requires another Python version than we are offering. Luckily
with environments it is easy to set up the Python version you require. Below follows an example of
how to setup an environment to use Python 3.8 using conda:

.. code-block:: bash

   #!/bin/bash
   # Install Python3.8 and get minimum set of dependencies.
   conda create -y -n py38 python=3.8 future
   conda install -y -n py38 ipykernel jupyter_client ipython_genutils pycryptodomex future
   conda run -n py38 pip install orchest

   # Set environment variables so that the new Python version is
   # used when executing the pipeline and inside kernels. The variables
   # are set here so that they are isolated within the environment.
   # NOTE: We are first overwriting the `.bashrc` file to make sure the
   # environment variables are unaffected by existing code in the file.
   echo "export JUPYTER_PATH=/opt/conda/envs/py38/share/jupyter" > /home/jovyan/.bashrc
   echo "export CONDA_ENV=py38" >> /home/jovyan/.bashrc

Lastly, you need to set a project (or pipeline) :ref:`environment variable <environment variables>`
to make sure that the ``.bashrc`` is actually sourced.

.. list-table::
   :widths: 25 25
   :header-rows: 1
   :align: left

   * - Name
     - Value

   * - ``BASH_ENV``
     - ``/home/jovyan/.bashrc``
