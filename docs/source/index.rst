Orchest
=======

`Website <https://www.orchest.io>`_
-- `GitHub <http://www.github.com/orchest/orchest>`_
-- `Slack <https://join.slack.com/t/orchest/shared_invite/zt-g6wooj3r-6XI8TCWJrXvUnXKdIKU_8w>`_

.. tip::
   👉 Get started with the :ref:`quickstart <quickstart>`! Or if you like watching short informative
   videos checkout our `knowledge base <https://www.orchest.io/knowledge-base>`_.

Orchest is a tool for creating data science pipelines. Orchest enables you to develop, train and run
your models on the cloud without any knowledge of cloud infrastructure.

A pipeline in Orchest can be thought of as a graph consisting of executable files within their own
isolated environment (powered by containerization). You get to describe the execution order of these
executable files through our visual pipeline editor. After coding your scripts, Orchest allows you
to select and run any subset of the pipeline whilst keeping in mind the defined execution order.

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
   developer_guide/front_end
   developer_guide/implementation_details
