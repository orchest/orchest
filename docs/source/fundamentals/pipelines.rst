.. _pipelines:

Pipelines
=========
.. tip::
   👉 Check out the `creating a pipeline from scratch video
   <https://www.tella.tv/video/cknr7zwz2000408i7bngpd77q/view>`_ to learn how to create a pipeline
   in the visual editor.

Pipelines are the core unit of execution in Orchest. A pipeline can be thought of as a graph,
where the nodes are executable files that execute within their own isolated environment (powered by
containerization - see :ref:`environments <environments>`), and the edges define the execution order
and the way the data flows (see :ref:`data passing <data passing>`).

Pipelines are build using the visual editor and are under the hood stored in JSON format in the so
called :ref:`pipeline definition <pipeline definition>` inside the :ref:`project <projects>`. This
means that changes to the pipeline can also be versioned, e.g. adding a new step or using a
different :ref:`environment <environments>` to execute the code.

.. figure:: ../img/quickstart/final-pipeline.png
   :width: 800
   :align: center

   The :ref:`quickstart <quickstart>` pipeline.

Additionally, pipelines can also be thought of as functions: given a set of parameters, the pipeline
can produce different outputs. For example, a parameter can set the connection URL of a data source
which obviously impacts the output of the pipeline. Parameters define the pipeline runs that are
part of a :ref:`job <jobs>`, and to be able to easily build out your pipelines (and jobs) parameters
can also be set and interacted with in the visual pipeline editor.

.. tip::
   👉 For secrets it is recommended to use :ref:`environment variables <environment variables>`
   given that parameters are versioned.

Running a pipeline
------------------
.. note::
   In this section we will learn what it means to run a pipeline :ref:`interactively <interactive
   pipeline run>`, when to do it, how to do it and what to keep in mind.

Now that we know how a pipeline is defined, how do you actually run a pipeline? In Orchest,
pipelines can be run in two ways (in no particular order):

* Interactively (inside the pipeline editor itself).
* As part of :ref:`jobs <jobs>`.

A pipeline can be run (interactively) by opening the pipeline editor, selecting any number of steps
and pressing *run selected steps*. When using Jupyter Notebooks as your pipeline steps, then during
the pipeline run the notebook files (``.ipynb`` extension) will be actively changed as if running
the individual cells from within JupyterLab. This is great to rapidly prototype your pipeline!

When running your pipeline, its passed data will be stored (in memory) as part of the :ref:`session
<interactive session>`. This means that you can access this data directly from within JupyterLab
cell as well.

Data passing
------------
.. tip::
   👉 Check out the dedicated :ref:`data passing <data passing>` section to learn all there is to
   know about data passing.

Pipeline steps can pass data to their connected steps. This can be helpful for e.g. ETL pipelines,
the first step extracts the data and passes it to the next which then transforms it and passes it to
the last step.

Data is passed using the :ref:`Orchest SDK <orchest sdk>`:

.. code-block:: python

   import orchest

   # Get data from incoming steps.
   input_data = orchest.get_inputs()

   # Some code that transforms the `input_data`.
   res = ...

   # Output the data.
   orchest.output(res, name="transformed-data")

The output data is then stored inside memory so that other steps can access it. Because the data is
cached in memory, arbitrary subsets of the pipeline can be run instead of always requiring the
pipeline to run in its entirety.

Storing data
------------
Sometimes you might want to store your data locally, e.g. after having pulled it from an S3 bucket,
instead of just keeping it in memory. As you will learn in the section on :ref:`jobs <jobs>`, jobs
make a snapshot (to make jobs reproducible) of the project directory. Thus storing data directly
inside the project directory would result in it being copied every time a new job is created. In
addition, it is unlikely you want to include that data inside your git repository.

As a solution, every pipeline step has access to the ``/data`` directory to which it can write data
that will be stored on disk. This directory is accessible from every pipeline across all projects
(even inside jobs).

For example:

.. code-block:: python

   # Get a text file from some external source.
   txt_data = ...

   with open("/data/nltk_example_text.txt", "w") as f:
       f.write(txt_data)
