Installing additional packages
==============================

.. TODO
   This section needs to be updated to the latest environments feature

Orchest runs all your individual pipeline steps (e.g. ``.ipynb`` or ``.R`` scripts) in
containers. The default images are based on the |jupyter_stack_link| and come with a number of
|pre_installed_link|.

To install additional packages or to run other terminal commands inside the base image, we support
custom *Images*. We essentially create a new image by running your script inside the selected base
image.

1. Simply go to *Images* in the left menu pane.
2. Select the base image. This image will be extended with your custom script. 
3. Click the "+" sign to add a commit to the base image. The commit represents the changes of your
   script.
4. Choose a *Commit name*.
5. Install additional packages, e.g. :code:`pip install tensorflow` or :code:`sudo apt install vim`.

.. |jupyter_stack_link| raw:: html

  <a href="https://jupyter-docker-stacks.readthedocs.io/en/latest/"
  target="_blank">Jupyter Docker Stacks</a>

.. |pre_installed_link| raw:: html

   <a
   href="https://jupyter-docker-stacks.readthedocs.io/en/latest/using/selecting.html"
   target="_nlank">pre-installed packages</a>

.. warning::
   Do not install packages by running :code:`!pip install <package-name>` inside your
   Jupyter Notebook. This causes the package to be installed every time you run the pipeline
   step. It is not saved in the environment as containers are stateless!
