# When to use Orchest

```{eval-rst}
.. meta::
   :description: This page contains advice on when to use Orchest, who is Orchest good for, and when you might want to look for alternatives.
```

You might be wondering when to use Orchest since there are several workflow management
and pipeline orchestration solutions out there.
They all share some similarities: they all provide some way to define a {term}`DAG` of tasks,
and infrastructure to monitor its results. However, there are notable differences between tools.

## Who is Orchest good for?

- **Small data teams tasked with a broad range of responsibilities**:
  If your team is small and is responsible for everything from analytics to MLOps,
  you will probably benefit from using Orchest: its interface is easy to learn,
  turning notebooks into {ref}`batch jobs <Jobs>` is straightforward,
  and it will take care of orchestrating the computation behind the scenes.

- **Data Scientists and Engineers that love Jupyter notebooks**:
  Even though you can use scripts as your {term}`pipeline steps <Pipeline step>` as well,
  Orchest has deep JupyterLab integration, bundles a few useful extensions,
  and is integrated seamlessly with your existing workflow.
  If you already love Jupyter notebooks, then you will feel right at home in Orchest.

- **Anyone who is looking to create pipelines through a visual interface**:
  Rather than defining your steps in YAML files, you can connect them with the Orchest
  {ref}`Pipeline editor <pipelines>`. You can even get started by creating a pipeline
  from an existing {ref}`project <projects>` straight away: assign your existing files
  to steps and connect them to form a {ref}`pipeline <pipelines>`.

## When are the alternatives worth considering?

There are some cases in which Orchest might not be the best tool for your use case.
Here are a few of them:

- **If your steps need more granularity**:
  In Orchest, every {term}`Pipeline step` is either a Jupyter Notebook or a script
  written in any of the currently supported {ref}`languages`. However, if you want
  to describe your computation in terms of _functions_, you might want to look
  into frameworks like Apache Airflow.

- **If you want to define your steps with a low-code tool**:
  The Orchest Pipeline editor is a visual interface that allows you to connect the different
  steps of your {term}`DAG`. However, each of those steps contains actual code that you
  or someone from your team needs to write. If you are looking for a tool that is apt
  for non-coders as well, something like Dataiku might better suit your use case.

- **If you need a more integrated solution**:
  Orchest allows you to define pipelines with scripts and notebooks, and you can reuse
  any open source library or framework you need for your tasks. However, you might be
  looking for a more integrated solution that assists you with some common tasks instead of
  having to implement them yourself, like experiment tracking, model serving, hyperparameter
  tuning, and such. In this case, Apache Airflow, Kubeflow, or Azure Data Factory
  might be better for your needs.
