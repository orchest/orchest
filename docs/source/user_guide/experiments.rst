.. _experiments:

Experiments
===========

Concepts
--------
.. For reproducibility we make a full snapshot by copying the project directory. So make sure to put
   data in `/data` or some other data source, otherwise it will be copied for experiments.

Run an experiment
-----------------
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
