(pipelines)=

# Pipelines

```{eval-rst}
.. meta::
   :description: This page contains information about how to create and use pipelines in Orchest.
```

Pipelines are an interactive tool for creating and experimenting with your data workflow in Orchest.

A pipeline is made up of steps and connections:

- Steps are executable files that run in their own isolated {ref}`environments <environments>`.
- Connections link steps together to define how data flows (see {ref}`data passing <data passing>`)
  and the order of step execution.

Pipelines are edited visually and stored in JSON format in the {term}`pipeline definition` file.
This allows pipeline changes (e.g. adding a step) to be versioned.

```{figure} ../img/quickstart/final-pipeline.png
:align: center
:width: 800
:alt: The quickstart pipeline in Orchest

The {ref}`quickstart <quickstart>` pipeline.
```

```{tip}
👉 Check out the [creating a pipeline from scratch video] to learn how to create a pipeline in the visual editor.
```

[creating a pipeline from scratch video]: https://www.tella.tv/video/cknr7zwz2000408i7bngpd77q/view

## Running a pipeline in Orchest

Once set up, you can run your pipeline in Orchest in two ways:

- {term}`Interactive runs <interactive (pipeline) run>` inside the pipeline editor.
- Job runs (see {ref}`job <jobs>`).

Interactive runs are a great way to rapidly prototype your pipeline. When using Jupyter Notebook
`.ipynb` files, pipeline steps are actively changed as if running individual cells in JupyterLab.
The output of pipeline steps is stored when you run a step as part of a {term}`session <interactive session>`.
This lets you run just the parts of the pipeline that you're working on rather than all of it.
You can access these outputs directly from within the JupyterLab kernel for notebook based steps.

## Parameterizing pipelines

Pipelines take parameters as input (e.g. the data source connection URL) to vary their behaviour.
{ref}`Jobs <jobs>` can use different parameters to iterate through multiple runs of the same
pipeline. Parameters can be set in the visual pipeline editor.

```{tip}
👉 For secrets, use {ref}`environment variables <environment-variables>` since parameters are versioned.
```

## Data passing

Pipelines can pass data between steps. For example, to define an ETL pipeline in Orchest,
you can pass data between the individual extract, transform and load steps.

Data is passed using the {ref}`Orchest SDK <orchest sdk>`:

```python
import orchest
# Get data from incoming steps.
input_data = orchest.get_inputs()
# Some code that transforms the `input_data`.
res = ...
# Output the data.
orchest.output(res, name="transformed-data")
```

See more in {ref}`data passing <data passing>`.

## Storing data locally

Pipeline steps can read and write from and to the `/data` directory,
which is accessible by all pipelines across all projects. For example:

```python
# Get a text file from some external source.
txt_data = ...

with open("/data/nltk_example_text.txt", "w") as f:
    f.write(txt_data)
```
