Orchest overview
================

Orchest is an open source, cloud native, development environment build for data science. Orchest
enables you to develop, train and run your models on the cloud without any knowledge of cloud
infrastructure.


The Orchest platform
--------------------

Orchest is not here to reinvent the wheel when it comes to your favorite editor, Orchest is a web
based platform that works on top of your filesystem (similar to JupyterLab) allowing you to
visually build and iterate on your pipelining ideas.

A pipeline in Orchest can be thought of as a single executable file (e.g. notebooks, python scripts, R
scripts) within its own isolated environment powered by containerization. Users get a visual
pipeline editor to describe the execution order of those executable files, which we will call
(pipeline) steps. After coding a subset of these steps, Orchest allows you to select and run any of
the steps whilst keeping in mind the defined execution order of the pipeline.

Orchest essentially helps you to modularize, i.e. split up, your single monolithic notebook or
script into pipeline steps and pass data between them.


What can I use Orchest for?
---------------------------

With Orchest, you get to build pipelines where each step has its own isolated environment allowing
you to focus on a specific task, may it be: data engineering, model building or even more low level
things such as data transforms.
