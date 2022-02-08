.. _jobs:

Jobs
====

.. tip::
    👉 Would you rather watch short video tutorials? Check them out here:

    * `Adding parameters to a pipeline <https://app.tella.tv/story/cknrahyn9000409kyf4s2d3xm>`_
    * `Running a pipeline as a job <https://app.tella.tv/story/cknr9nq1u000609kz9h0advvk>`_

Jobs are essentially just a set of :ref:`pipelines <pipelines>` that run now, in the future or
periodically. Since pipelines take parameters as an input, a job can schedule multiple runs of the
same pipeline each with other input values. For example, you want to use the exact same ETL pipeline
you've build but for every pipeline run use a different data source to extract data from.

The moment you create a new job a snapshot of your (versioned) project directory is created. For
every pipeline run that is part of the job, the snapshot is copied and the files are executed (this
means that Notebooks are changed in place without affecting the snapshot). Thanks to this snapshot
the job will run the same code throughout its lifetime and therefore produce the expected results.

.. note::
   💡 Write data and large artifacts to the special ``/data`` directory as they would otherwise be
   included in the snapshot, taking up unnessecary space. Alternatively, you can include the
   artifacts in your ``.gitignore`` as the ignored patterns are not copied to the snapshot.

.. _parametrize pipeline section:

Parametrizing pipelines and steps
---------------------------------
Before we get into jobs, it is good to first cover the notion of parametrizing your pipeline and
your pipeline steps. A job runs a specific pipeline for a given set of parameters. If you define
multiple values for the same parameter, then the job will run the pipeline once for every
combination of parameter values. First you need to define the possible parameters that your pipeline
can take for inputs. We allow you to define parameters for:

* Pipelines. The parameters and corresponding values will be available in every step of the
  pipeline.
* Pipeline steps. The parameters will only be accessible by the step they are defined for.

Different pipeline runs that are part of the same job are completely isolated from a scheduling
perspective and do not affect each others state.

.. note::
   💡 Unlike :ref:`environment variables <environment variables>`, name collisions between pipeline
   and step level parameters do not result in overwrite behavior. In other words, you can define
   pipeline and step level parameters with the same name without one (automatically) overwritting
   the other, you can access both values.

Editing pipeline parameters
~~~~~~~~~~~~~~~~~~~~~~~~~~~
You can edit your pipeline parameters through the pipeline settings:

1. Open a pipeline via the *Pipelines* option in the left menu pane.
2. Click on *SETTINGS* in the top right corner.
3. Towards the top you will find the *Pipeline parameters* section.
4. Input some JSON like :code:`{"my-param": <param-value>}`.
5. Make sure to press the black *Save* button towards the bottom of your screen.

Editing pipeline step parameters
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
To edit the parameters of the steps of a pipeline:

1. Open a pipeline via the *Pipelines* option in the left menu pane.
2. Click on a pipeline step to open its *Properties*.
3. Towards the bottom you will find the *Parameters* section.
4. Input some JSON like :code:`{"my-param": <param-value>}`.

.. _jobs parameters:

Interacting with parameters through code
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
After you have set parameters for your pipeline and/or steps you can use their values inside your
scripts (check out the :ref:`parameters API reference <api parameters>`).

Let's say you have set the following parameters on your pipeline:

.. code-block:: json

   {
     "vegetable": "carrot",
     "fruit": "banana"
   }

And for your pipeline step:

.. code-block:: json

   {
     "candy": "chocolate",
     "fruit": "apple"
   }

Then inside the pipeline step you can access the parameters as follows:

.. code-block:: python

   import orchest

   # Get the parameters of the current step and the pipeline.
   fruit = orchest.get_step_param("fruit")               # "apple"
   vegetable = orchest.get_pipeline_param("vegetable")   # "carrot"

.. _running a job:

Running a job
-------------
Make sure you have read the previous section on how to parametrize your pipeline. With jobs you get
to run the same pipeline for different parameter values. For now you can think of it as a `grid
search <https://scikit-learn.org/stable/modules/grid_search.html>`_, i.e. looping over all
combinations of values for different parameters. To run a job:

1. Make sure you have defined some parameters or you will only be able to schedule the pipeline as
   is.
2. Click on *Jobs* in the left menu pane.
3. Click the "+" sign to configure your job.
4. Choose a *Job name* and the *Pipeline* you want to run the job for.
5. Your default set of parameters are pre-loaded. By clicking on the values a JSON editor opens,
   allowing you to add additional values you would like the pipeline to run for.
6. If you would like to schedule the job to run at a specific time have a look at *Scheduling*. In
   case you don't want your job to run every combination of your parameter values, you can
   deselect them through the *Pipeline runs* option.
7. Press *Run job*.

To inspect the result of your job, simply click on the job you just created, choose a specific
pipeline run (the one you want to inspect) and open *View pipeline*. The pipeline is now opened in
:ref:`read-only mode <read-only mode>` giving you the opportunity to check the logs or to open the
HTML version of you notebooks.

.. note::
   💡 Upon job creation, Orchest (under the hood) takes a snapshot of the required environments.
   This way you can freely iterate on and update your existing environments without worrying about
   breaking your existing jobs.
