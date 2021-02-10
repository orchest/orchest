.. _environment_variables:

Environment variables
=====================

Defining environment variables can be useful when you want to avoid persisting sensitive data in your
versioning system. These environment variables will be injected in your pipeline steps, and can be
retrieved using the native way of your language of choice, e.g. ``os.environ["MY_VAR"]`` in Python.
It is possible to define environment variables at the project, pipeline or job level.


.. note::
   Keep in mind that environment variables are strings, and will be stored and injected as as such.
   For example the values ``postgres`` and ``"postgres"`` (as specified in the UI) will be injected
   as ``postgres`` and ``"postgres"`` respectively.

.. warning::
   Environment variables are persisted within Orchest. Make sure only authorized people have access
   to your instance and sensible data. See how to setup :ref:`authentication <authentication>` and
   how to setup :ref:`Orchest on the cloud <cloud installation>`.

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

Variables defined at the pipeline level override project variables, that is, if a project defines a
variable ``MY_VAR=PROJ_VALUE`` and a pipeline of the project defines ``MY_VAR=PIP_VALUE``, this
pipeline interactive runs will see the value ``PIP_VALUE``. You do not need to redefine environment
variables if you don't intend to override their values, of course, defining new variables is
perfectly fine.

You can access your pipeline environment variables through the pipeline settings:

1. Open a pipeline via the *Pipelines* option in the left menu pane.
2. Click on *SETTINGS* in the top right corner.
3. Click on the *Environment variables* tab.
4. Set your variables.
5. Make sure to press the blue *Save* button at the bottom of your screen.

Job environment variables
-------------------------

Since a job is related to a pipeline, its environment variables are initialized by merging the
project and pipeline env variables; those are the variables that would be defined for an interactive
pipeline run of the given pipeline. You can edit those variables (or add new ones) before submitting
the job, moreover, cron jobs can have their environment variables edited after they have started.
Every pipeline run belonging to the job will have these environment variables set.

Environment variables inside Notebooks
--------------------------------------

Environment variables will also be available in kernels that are launched in JupyterLab. To
refresh the environment variables for kernels a restart of the session is required. As per usual
the environment variables defined at the pipeline level override the project defined environment
variables (of the same name).
