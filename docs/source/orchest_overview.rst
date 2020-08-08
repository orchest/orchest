Orchest overview
================

Orchest is a tool for creating data science pipelines. Orchest enables you to develop, train and run
your models on the cloud without any knowledge of cloud infrastructure.


The Orchest platform
--------------------

Orchest is not here to reinvent the wheel when it comes to your favorite editor, Orchest is a web
based platform that works on top of your filesystem (similar to JupyterLab) allowing you to use your
editor of choice. With Orchest you get to focus on visually building and iterating on your
pipelining ideas.

.. [INSERT PICTURE/GIF: show pipeline]

A pipeline in Orchest can be thought of as a graph consisting of executable files, e.g. notebooks or
scripts, within their own isolated environment (powered by containerization). Users get a visual
pipeline editor to describe the execution order of individual steps that represent those executable
files. After coding your scripts, Orchest allows you to select and run any subset of the steps
whilst keeping in mind the defined execution order of the pipeline.

Orchest essentially provides your with a development environment for your data science efforts
without taking away the tools you know and love.


What can I use Orchest for?
---------------------------

With Orchest, you get to build pipelines where each step has its own isolated environment allowing
you to focus on a specific task, may it be: data engineering, model building or more low level
things such as data transforms.

With Orchest you get to:

* Visually construct pipelines.
* Code your data science efforts in your editor of choice.
* Modularize, i.e. split up, your (monolithic) notebooks.
* Run any selection of pipeline steps. 
* Select specific notebook cells to skip when running a pipeline through the pre-installed celltags
  extension of JupyterLab.
* Parametrize your data science pipelines to experiment with different modeling ideas.

What Orchest does for you:

* Provide you with an interactive pipeline editing view.
* Manage your dependencies and environments.
* Run your pipelines based on the defined execution order.
* Pass data between your steps.


Orchest roadmap
---------------

Orchest is just beginning to take shape. In the near future you can expect the following features:

* Managed hosted version to easily try out the Orchest platform.
* Integration to load in your existing projects from GitHub. Note that you can already setup Orchest
  for an existing project on your filesystem.
