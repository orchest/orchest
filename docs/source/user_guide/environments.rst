.. _install packages:

Installing packages
===================

.. tip::
    👉 Would you rather watch a short video tutorial? Check it our here: `installing packages
    <https://app.tella.tv/story/cknr8owf4000308kzalsk11a5>`_.

.. warning::
   Do not install packages by running :code:`!pip install <package-name>` inside your
   Jupyter Notebook. This causes the package to be installed every time you run the pipeline
   step. It is not saved in the environment as containers are stateless!

Orchest runs all your individual pipeline steps (e.g. ``.ipynb`` or ``.R`` scripts) in containers.
The default images are based on the `Jupyter Docker Stacks
<https://jupyter-docker-stacks.readthedocs.io/en/latest/>`_ and come with a number of `pre-installed
packages <https://jupyter-docker-stacks.readthedocs.io/en/latest/using/selecting.html>`_.

To install additional packages or to run other terminal commands inside the base image, we support
custom :ref:`environments <environment glossary>`. We essentially create a new image by running your
script inside the selected base image.

.. note::
    If an environment is in use by an active Jupyter kernel, then changes to the environment require
    a restart of the kernel (which can be done through the JupyterLab UI).

.. _environments:

Build an environment
--------------------

1. Simply go to *Environments* in the left menu pane.
2. Create a new *Environment*. *Environments* are part of a single project.
3. Choose an *Environment name*.
4. Choose a base image. This image will be extended through your setup bash script.
   Custom images must have USER `root` or ``sudo`` must be installed, ``find`` must also be installed.
5. To keep environment image sizes to a minimal, each environment is tied to a specific programming
   language. Choose one of the supported languages for your environment.
6. Go to the *BUILD* tab to install additional packages by adding their installation steps to the *Environment set-up
   script*, e.g. :code:`pip install tensorflow` or :code:`sudo apt-get install gcc`.
7. Finally, press the *Build* button at the bottom.

.. tip::

    The shell script that installs the additional packages is run inside the ``/project-dir``,
    meaning that you can directly interact with your project files from within the script. For
    example:

    .. code-block:: bash

       #!/bin/bash

       # Install any dependencies you have in this shell script.

       # E.g. pip install tensorflow
       pip install -r requirements.txt
