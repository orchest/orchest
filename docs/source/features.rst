Features
========

Data passing
------------
To pass data between the different pipeline steps, across different languages, we make use of the
`Apache Arrow <https://github.com/apache/arrow>`_ project. The :ref:`Orchest SDK` provides a
convenience wrapper of the project to be used within Orchest.

See :ref:`sdk-quickstart-data-passing` to get started directly.


Installing additional packages
------------------------------
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

Experiments
-----------
Before we get into experiments, it is good to first cover the notion of parameterizing your pipeline
steps.

1. Open a pipeline via the *Pipelines* option in the left menu pane.
2. Click on a pipeline step to open its *Properties*.
3. Towards the bottom you will find the *Parameters* section. 
4. Input some JSON like :code:`{"my-param": <param-value>}`.
5. Make sure to press the black *Save* button towards the top of your screen.

You can now access the value of those parameters (and even update them) from within the script of
the respective pipeline step.  See :ref:`sdk-quickstart-parameters` to get started on using
parameters inside your scripts.

Now that we have covered how to parameterize your pipeline (steps) we will introduce experiments.
With experiments you get to try out all your modeling ideas by iterating over different parameter
values. For now you can think of it as a `grid search
<https://scikit-learn.org/stable/modules/grid_search.html>`_. To start an experiment

1. Make sure you have defined some parameters or you will only be able to schedule the pipeline as
   is.
2. Click on *Experiments* in the left menu pane.
3. Click the "+" sign to configure your experiment.
4. Choose an "Experiment name" and the "Pipeline" you want to run the experiment for.
5. Your default set of parameters are pre-loaded. By clicking on the values a JSON editor opens,
   allowing you to add additional values you would like to try out.
6. If you would like to schedule the experiment to run at a specific time have a look at
   *Scheduling*. In case you don't want your grid search to run every combination of your parameter
   values, you can deselect them through the *Pipeline runs* option.
7. Press *Run experiment*.

To inspect the result of your experiment, simply click on the experiment you just created, choose a
specific pipeline run (the one you want to inspect) and open *View pipeline*. The pipeline is now
opened in *Read only* mode giving you the opportunity to check the logs or to open the HTML version
of you notebooks.


.. _features-data-sources:

Data sources
------------
It is common for data to be stored elsewhere and to connect to those data sources from within your
scripts. To make sure that all the secrets can be managed seperately, they are stored in a central
place.

Get started with data sources by configuring one through the *Data sources* option in the left pane
menu.

1. Click on *Data sources* in the left menu pane.
2. Click on the "+" sign to add a data source.
3. Specify a "Name" and "Data source type".
4. Put in the "Connection details" to connect to the data source. For example for a MySQL database,
   you'd have to specify the "Host", "Database name", "Username" and "Password".
5. Lastly, press *Save*.

Next, see :ref:`sdk-quickstart-data-sources` in the SDK section to get started with data sources
from within your scripts.

.. note::
   For full reproducibility of your experiments, Orchest creates a snapshot of your active pipeline
   directory. Therefore it is recommended to never write large amounts of data to your pipeline
   directory but to use the *Filesystem directory* data source type instead. It is nothing more than
   a special path that gets mounted for the purpose of storing large amounts of data.


Tips and tricks
---------------
* Hold down ``<Space>`` inside the pipeline editor to drag the canvas (similar to design tools such
  as Sketch).
* On your host machine, in the terminal, run :code:`docker ps -f network=orchest` to see all the
  containers that Orchest is running.
