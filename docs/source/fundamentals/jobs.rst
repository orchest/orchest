.. _jobs:

Jobs
====

.. tip::
    👉 Would you rather watch a short video tutorial? Check it our here: `adding parameters to a
    pipeline <https://app.tella.tv/story/cknrahyn9000409kyf4s2d3xm>`_ and `running a pipeline as a
    job <https://app.tella.tv/story/cknr9nq1u000609kz9h0advvk>`_.

.. tip::
   For reproducibility Orchest makes a full snapshot by copying the project directory. So make sure
   to write data to ``/data`` in your scripts, otherwise the data will be included in the snapshot.


.. _parametrize pipeline section:

Parametrizing your pipeline and steps
-------------------------------------
Before we get into jobs, it is good to first cover the notion of parameterizing your pipeline and
your pipeline steps. A job runs a specific pipeline for a set of parameters, these parameters have
to be defined first before you can set their value for a job. We allow you to define parameters at
two different levels:

* Pipeline level. The parameters and corresponding values will be available in every step of the
  pipeline.
* Pipeline step level, for parameters that are only accessible by the step they are defined for.

.. note::
   Unlike :ref:`environment variables <environment variables>`, name collisions between pipeline and
   step level parameters do not result in overwrite behavior. In other words, you can define
   pipeline and step level parameters with the same name without one (automatically) overwritting
   the other, you can access both values.

You can edit your pipeline parameters through the pipeline settings:

1. Open a pipeline via the *Pipelines* option in the left menu pane.
2. Click on *SETTINGS* in the top right corner.
3. Towards the top you will find the *Pipeline parameters* section.
4. Input some JSON like :code:`{"my-param": <param-value>}`.
5. Make sure to press the black *Save* button towards the bottom of your screen.

To edit the parameters of the steps of a pipeline:

1. Open a pipeline via the *Pipelines* option in the left menu pane.
2. Click on a pipeline step to open its *Properties*.
3. Towards the bottom you will find the *Parameters* section.
4. Input some JSON like :code:`{"my-param": <param-value>}`.

You can now access the value of those parameters (and even update them) from within the script of
the respective pipeline step. See the :ref:`parameters section <sdk-quickstart-parameters>` to get
started on using parameters inside your scripts.

.. _running a job:

Running a job
-------------


Make sure you have first read the previous section on how to parametrize your pipeline.  With jobs
you get to try out all your modeling ideas by iterating over different parameter values. For now you
can think of it as a `grid search <https://scikit-learn.org/stable/modules/grid_search.html>`_. To
start a job:

1. Make sure you have defined some parameters or you will only be able to schedule the pipeline as
   is.
2. Click on *Jobs* in the left menu pane.
3. Click the "+" sign to configure your job.
4. Choose an "Job name" and the "Pipeline" you want to run the job for.
5. Your default set of parameters are pre-loaded. By clicking on the values a JSON editor opens,
   allowing you to add additional values you would like to try out.
6. If you would like to schedule the job to run at a specific time have a look at *Scheduling*. In
   case you don't want your grid search to run every combination of your parameter values, you can
   deselect them through the *Pipeline runs* option.
7. Press *Run job*.

To inspect the result of your job, simply click on the job you just created, choose a specific
pipeline run (the one you want to inspect) and open *View pipeline*. The pipeline is now opened in
:ref:`read-only mode <read-only mode>` giving you the opportunity to check the logs or to open the
HTML version of you notebooks.

.. note::
   Upon job creation, Orchest takes a snapshot of the required environments.  This way you can
   freely iterate on and update your existing environments without worrying about breaking your
   existing jobs.
