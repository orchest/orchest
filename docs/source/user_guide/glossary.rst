Glossary
========

.. _pipeline definition:

Pipeline definition
    A file with the ``.orchest`` extension.

    * Every pipeline definition in a project is shown in the Orchest UI under *Pipelines*.
    * The JSON inside the file uniquely defines the :ref:`pipeline <pipeline>`.

.. _pipeline step:

Pipeline step
    A single unit of execution, that receives data, operates on it, and outputs it (which can be
    retrieved by a next step).

    * Has a one-to-one relationship with an executable file, which runs inside its own execution
      environment, powered through containerization.
    * The file can be edited (through your favorite editor), e.g. just like a Jupyter Notebook. Can also
      be run through a :ref:`pipeline run <pipeline run>`.
    * Has an execution state, i.e. *READY*, *PENDING*, *RUNNING*, *COMPUTED*, *ABORTED* or *FAILURE*.
    * A step can have a set of parameters, all of which have to be given a default value. (The set
      of parameters can also be empty, thus the step not having any parameters.) These parameters
      are stored inside the :ref:`pipeline definition <pipeline definition>` and are accessible
      inside the execution environment.

.. _pipeline:

(Data science) pipeline
    A DAG of :ref:`pipeline steps <pipeline step>`.

.. _interactive session:

Interactive session
    Some notion of a session that you can boot and shut down which gives you additional functionality
    when it comes to editing and running your pipelines.

    * Automatically boots: Jupyter environment and ``memory-server``.
    * Required in order to start an :ref:`interactive pipeline run <interactive pipeline run>`.

.. _pipeline run:

Pipeline run
    Abstraction to execute pipelines.

    * Can be scheduled to run at a specific time (through experiments).
    * If parameterized, runs for selected (by the user) default values. If not parameterized, runs
      without any parameter values.

.. _interactive pipeline run:

Interactive (pipeline) run
    A pipeline run that runs instantly and that actively changes the pipeline directory’s filesystem.
    These interactive pipeline runs can only be run during an :ref:`interactive session <interactive
    session>`.

.. _non-interactive pipeline run:

Non-interactive (pipeline) run
    A pipeline run that runs on its own copy of the pipeline directory. This type of pipeline run is the
    building block of :ref:`experiments <experiment>`.

.. _experiment:

Experiment
    A set of pipeline runs (where each pipeline will run for a different set of parameters).  Currently
    we support the following types of experiments:

    * Grid search: a collection of :ref:`non-interactive pipeline runs <non-interactive pipeline run>`
      that is scheduled to run at a later time. The user can specify values for the parameters other
      than the default values. The `scikit-learn docs
      <https://scikit-learn.org/stable/modules/grid_search.html>`_ are a great resource to read more
      about grid searches.

.. _environment glossary:

Environment
    The runtime environment of a pipeline step. This way you can install additional packages and
    make changes to the base image directly.

Edit mode
    Edit, create and run your :ref:`pipelines <pipeline>`.

Read-only mode
    View your pipeline and its results from a past run.

    * A pipeline from read-only mode can be created into a pipeline in edit mode. This can be useful if
      you want to actively play with the environment that produced the results (state is not stored
      after execution has finished, unless it is an :ref:`interactive run <interactive pipeline run>`). 
