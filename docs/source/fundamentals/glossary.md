# Glossary

```{glossary}

DAG
    DAG stands for **directed acyclic graph**, and it's the most widely used data structure
    for data worflows:

    * It's a **graph** (in the mathematical sense) since it connects a set of steps
      (in the case of Orchest, a {term}`Pipeline step`).
    * It's **directed** because those connections have a specific direction
      (from one step to the other). For example, a step loads the data, and hands it
      to the following step to process it.
    * It's **acyclic** because it has no _cycles_ (or feedback loops). In other words,
      there is no way to follow the connections of the graph starting from one step
      and come back to the same step. This is important because it means that the execution
      of a pipeline is guaranteed to finish at some point.

Pipeline step
    A single unit of execution, that receives data, operates on it, and outputs it (which can be
    retrieved by a next step).

    * Has a one-to-one relationship with an executable file, which runs inside its own execution
      {term}`Environment`, powered through containerization. This executable
      file can be edited through Orchest's JupyterLab integration.
    * Is executed as part of a {term}`Pipeline run`.
    * Has an execution state, i.e. *READY*, *PENDING*, *RUNNING*, *COMPUTED*, *ABORTED* or *FAILURE*.
    * A step can have a set of parameters, all of which have to be given a default value. (The set
      of parameters can also be empty, thus the step not having any parameters.) These parameters
      are stored inside the {term}`Pipeline definition` and are accessible
      inside the execution environment.

(Data science) pipeline
    A {term}`DAG <DAG>` of {term}`pipeline steps <Pipeline step>` defined in its respective
    {term}`Pipeline definition`.

Pipeline definition
    A file with the ``.orchest`` extension inside the project directory. The pipeline editor you see
    in Orchest is a UI handle to the file containing the pipeline definition.

    * The JSON inside the file uniquely defines the {term}`pipeline <(Data science) pipeline>`.
    * Every pipeline definition in a project is automatically detected and listed in the Orchest UI
      under *Pipelines*.
    * A full [JSON Schema](https://json-schema.org/) definition can be found
      {ref}`here <pipeline-json-schema>`.

Interactive session
    Some notion of a session that you can boot and shut down which gives you additional functionality
    when it comes to editing and running your pipelines. The lifetime of a session can be managed
    inside the pipeline editor. A session is automatically started for you when opening up a pipeline.

    * Automatically boots and manages: JupyterLab, jupyter-enterprise-gateway, and the {ref}`Services`.
    * Required in order to start an {term}`interactive pipeline run <Interactive (pipeline) run>`.

Pipeline run
    Abstraction to execute pipelines.

    * Can be scheduled to run at a specific time (through {term}`jobs <job>`).
    * If parameterized, runs for selected (by the user) default values. If not parameterized, runs
      without any parameter values.

Interactive (pipeline) run
    A pipeline run that runs instantly and that actively changes the pipeline directory’s filesystem.
    These interactive pipeline runs can only be run during an {term}`Interactive session` inside
    the pipeline editor.

Non-interactive (pipeline) run
    A pipeline run that runs on its own snapshot of the pipeline directory. This type of pipeline
    run is the building block of {term}`jobs <job>`.

Job
    A set of pipeline runs (where each pipeline will run for a different set of parameters). Currently
    we support the following types of jobs:

    * Grid search like jobs: a collection of
      {term}`non-interactive pipeline runs <Non-interactive (pipeline) run>`
      that is scheduled to run at a later time. The user can specify values for the
      parameters other than the default values. The [scikit-learn docs] are a great resource to read more
      about grid searches.
    * Cron jobs: similar to grid search like jobs, but running on a cron schedule.

    Read the {ref}`Jobs` section of the documentation to know more.

Environment
    The runtime environment of a {term}`pipeline step <Pipeline step>`. Using environments you can
    install additional packages and make changes to the base image directly.

Edit mode
    Edit, create and run your {term}`pipelines <(Data science) pipeline>` inside the pipeline editor.

Read-only mode
    View your pipeline and its results from a past run (mainly applicable in {term}`jobs <Job>`).

    * A pipeline from read-only mode can be created into a pipeline in edit mode. This can be useful if
      you want to actively play with the environment that produced the results (state is not stored
      after execution has finished, unless it is an {term}`interactive run <Interactive (pipeline) run>`).

```

[scikit-learn docs]: https://scikit-learn.org/stable/modules/grid_search.html
