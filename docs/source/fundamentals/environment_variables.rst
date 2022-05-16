.. _environment variables:

Environment variables
=====================
Defining environment variables can be useful when you want to avoid persisting sensitive data in your
versioning system. These environment variables will be injected in your pipeline steps, and can be
retrieved using the native way of your language of choice, for example in Python:

.. code-block:: python

   import os
   secret = os.environ["MY_VAR"]

It is possible to define environment variables for projects, pipelines and jobs. The environment
variables set for these different entities have different priorities: environment variables with the
same name in jobs take precedence over pipelines, take precedence over projects.

Thus pipeline level environment variables would overwrite project level environment variables. For
example, given that ``MY_VAR=PROJ_VALUE`` is defined at the project level and ``MY_VAR=PIP_VALUE``
at the pipeline level, the value of ``MY_VAR`` for :ref:`interactive pipeline runs <interactive
pipeline run>` is ``PIP_VALUE``.

.. warning::
   🚨 Environment variables are persisted within Orchest. Make sure only authorized people have
   access to your instance and sensible data. See how to setup authentication in the :ref:`orchest
   settings <orchest settings>`.

.. note::
   👉 Changes to the ``PATH`` variable are ignored given that it could break the execution of your
   code.

Project environment variables
-----------------------------
Every variable defined at the project level will be visible to every run of a pipeline belonging to
the project (this includes pipelines that run as part of jobs).

You can access your project environment variables through the project settings:

1. Open the *Projects* view in the left menu pane.
2. Click on gear icon (in the *settings* column) in the row representing the project of interest.
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
project and pipeline environment variables (this are the variables that would be defined for an
interactive pipeline run of the given pipeline).

You can then edit those variables (or add new ones) before submitting the job. Every pipeline run
belonging to the job will have these environment variables set.

.. note::
   💡 Only periodically scheduled jobs can have their environment variables edited after they have
   started.

Environment variables inside Notebooks
--------------------------------------
Environment variables will also be available in kernels that are launched in JupyterLab. To refresh
the environment variables for kernels a restart of the :ref:`interactive session <interactive
session>` is required. As per usual the environment variables defined at the pipeline level override
the project's environment variables.
