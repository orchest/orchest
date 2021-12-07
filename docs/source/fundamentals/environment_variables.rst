.. _environment variables:

Environment variables
=====================

Defining environment variables can be useful when you want to avoid persisting sensitive data in your
versioning system. These environment variables will be injected in your pipeline steps, and can be
retrieved using the native way of your language of choice, e.g. ``os.environ["MY_VAR"]`` in Python.

It is possible to define environment variables at the project, pipeline or job level. Defining
environment variables with the same name at different levels, will cause the value set in lower
priority levels to be overwritten. The hierarchy is as follows (the higher in the list, the higher
the priority):

1. Job environment variables.
2. Pipeline environment variables.
3. Project environment variables.

Thus pipeline level environment variables would overwrite project level environment variables. For
example, given that ``MY_VAR=PROJ_VALUE`` is defined at the project level and ``MY_VAR=PIP_VALUE``
at the pipeline level, the value of ``MY_VAR`` for :ref:`interactive pipeline runs <interactive
pipeline run>` is ``PIP_VALUE``.

.. note::
   Keep in mind that environment variables are strings, and will be stored and injected as such.
   For example the values ``postgres`` and ``"postgres"`` (as specified in the UI) will be injected
   as ``postgres`` and ``"postgres"`` respectively.

.. warning::
   🚨 Environment variables are persisted within Orchest. Make sure only authorized people have
   access to your instance and sensible data. See how to setup :ref:`authentication
   <authentication>` and how to :ref:`self-host Orchest <self-host orchest>`.

Project environment variables
-----------------------------

Every variable defined at the project level will be visible to every interactive pipeline run of a
pipeline belonging to the project.

You can access your project environment variables through the project settings:

1. Open the *Projects* view in the left menu pane.
2. Click on the row representing the project of interest to get to its settings.
3. Towards the top you will find the *Project environment variables* section.
4. Set your variables.
5. Make sure to press the blue *Save* button at the bottom of your screen.

Pipeline environment variables
------------------------------

You can access your pipeline environment variables through the pipeline settings:

1. Open a pipeline via the *Pipelines* option in the left menu pane.
2. Click on *Settings* in the top right corner.
3. Click on the *Environment variables* tab.
4. Set your variables.
5. Make sure to press the blue *Save* button at the bottom of your screen.

Job environment variables
-------------------------

Since a job is related to a pipeline, its environment variables are initialized by merging the
project and pipeline env variables; those are the variables that would be defined for an interactive
pipeline run of the given pipeline.

You can then edit those variables (or add new ones) before submitting the job. Every pipeline run
belonging to the job will have these environment variables set.

.. note::
   Only cron jobs can have their environment variables edited after they have started.

Environment variables inside Notebooks
--------------------------------------

Environment variables will also be available in kernels that are launched in JupyterLab. To
refresh the environment variables for kernels a restart of the :ref:`interactive session
<interactive session>` is required. As per usual the environment variables defined at the pipeline
level override the project defined environment variables.
