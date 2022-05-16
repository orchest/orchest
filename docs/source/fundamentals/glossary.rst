Glossary
========

.. _pipeline step:

Pipeline step
    A single unit of execution, that receives data, operates on it, and outputs it (which can be
    retrieved by a next step).

    * Has a one-to-one relationship with an executable file, which runs inside its own execution
      :ref:`environment <environment glossary>`, powered through containerization. This executable
      file can be edited through Orchest's JupyterLab integration.
    * Is executed as part of a :ref:`pipeline run <pipeline run>`.
    * Has an execution state, i.e. *READY*, *PENDING*, *RUNNING*, *COMPUTED*, *ABORTED* or *FAILURE*.
    * A step can have a set of parameters, all of which have to be given a default value. (The set
      of parameters can also be empty, thus the step not having any parameters.) These parameters
      are stored inside the :ref:`pipeline definition <pipeline definition>` and are accessible
      inside the execution environment.

.. _pipeline:

(Data science) pipeline
    A DAG of :ref:`pipeline steps <pipeline step>` defined in its respective :ref:`pipeline
    definition <pipeline definition>`.

.. _pipeline definition:

Pipeline definition
    A file with the ``.orchest`` extension inside the project directory. The pipeline editor you see
    in Orchest is a UI handle to the file containing the pipeline definition.

    * The JSON inside the file uniquely defines the :ref:`pipeline <pipeline>`.
    * Every pipeline definition in a project is automatically detected and listed in the Orchest UI
      under *Pipelines*.
    * A full `JSON Schema <https://json-schema.org/>`_ definition can be found in the
      :ref:`implementation details <pipeline-json-schema>`.


.. _interactive session:

Interactive session
    Some notion of a session that you can boot and shut down which gives you additional functionality
    when it comes to editing and running your pipelines. The lifetime of a session can be managed
    inside the pipeline editor, or in the list pipelines. A session is automatically started for you
    when opening up a pipeline.

    * Automatically boots and manages: JupyterLab and jupyter-enterprise-gateway.
    * Required in order to start an :ref:`interactive pipeline run <interactive pipeline run>`.

.. _pipeline run:

Pipeline run
    Abstraction to execute pipelines.

    * Can be scheduled to run at a specific time (through :ref:`jobs <job>`).
    * If parameterized, runs for selected (by the user) default values. If not parameterized, runs
      without any parameter values.

.. _interactive pipeline run:

Interactive (pipeline) run
    A pipeline run that runs instantly and that actively changes the pipeline directory’s filesystem.
    These interactive pipeline runs can only be run during an :ref:`interactive session <interactive
    session>` inside the pipeline editor.

.. _non-interactive pipeline run:

Non-interactive (pipeline) run
    A pipeline run that runs on its own snapshot of the pipeline directory. This type of pipeline
    run is the building block of :ref:`jobs <job>`.

.. _job:

Job
    A set of pipeline runs (where each pipeline will run for a different set of parameters).  Currently
    we support the following types of jobs:

    * Grid search like jobs: a collection of :ref:`non-interactive pipeline runs <non-interactive
      pipeline run>` that is scheduled to run at a later time. The user can specify values for the
      parameters other than the default values. The `scikit-learn docs
      <https://scikit-learn.org/stable/modules/grid_search.html>`_ are a great resource to read more
      about grid searches.
    * Cron jobs: similar to grid search like jobs, but running on a cron schedule.

.. _environment glossary:

Environment
    The runtime environment of a :ref:`pipeline step <pipeline step>`. Using environments you can
    install additional packages and make changes to the base image directly.

Edit mode
    Edit, create and run your :ref:`pipelines <pipeline>` inside the pipeline editor.

.. _read-only mode:

Read-only mode
    View your pipeline and its results from a past run (mainly applicable in :ref:`jobs <jobs>`).

    * A pipeline from read-only mode can be created into a pipeline in edit mode. This can be useful if
      you want to actively play with the environment that produced the results (state is not stored
      after execution has finished, unless it is an :ref:`interactive run <interactive pipeline run>`).
