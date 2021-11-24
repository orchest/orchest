Orchest
=======

.. tip::
   👉 Get started with the :ref:`quickstart <quickstart>`!

Orchest is a tool for building data pipelines, made to be easy to use.

A pipeline in Orchest can be thought of as a graph, where the nodes are executable files that
execute within their own
isolated environment (powered by containerization), and the edges/connections define the way the data flows. All defined through our visual pipeline editor.

After coding your Notebooks and scripts, Orchest let's you run any subset of the pipeline either
interactively or on a cron-like schedule.

.. note::
   Orchest is in alpha.

.. toctree::
   :maxdepth: 1
   :caption: Getting started

   getting_started/overview
   getting_started/installation
   getting_started/starting_orchest
   getting_started/quickstart
   getting_started/help


.. toctree::
   :maxdepth: 1
   :caption: User guide

   user_guide/how_orchest_works
   user_guide/data_passing
   user_guide/environments
   user_guide/jobs
   user_guide/environment_variables
   user_guide/services
   user_guide/configure_jupyterlab
   user_guide/sdk/index
   user_guide/other
   user_guide/glossary


.. toctree::
   :maxdepth: 1
   :caption: Developer guide

   developer_guide/contributing
   developer_guide/development_workflow
   developer_guide/tests
   developer_guide/troubleshooting
   developer_guide/best_practices
   developer_guide/implementation_details
