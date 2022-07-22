(pipelines)=

# Pipelines

```{tip}
👉 Check out the [creating a pipeline from scratch video](https://www.tella.tv/video/cknr7zwz2000408i7bngpd77q/view) to learn how to create a pipeline in the visual editor.
```

Pipelines are an interactive tool for creating and experimenting with your data workflow.

A pipeline is made up of steps and connections:

- Steps are executable files that run in their own isolated {ref}`environments <environments>`.
- Connections link steps together to define how data flows (see {ref}`data passing <data passing>`)
  and the order of step execution.

Pipelines are edited visually and stored in JSON format in the {term}`pipeline definition`
file. This allows pipeline changes (e.g. adding a step) to be versioned.

```{figure} ../img/quickstart/final-pipeline.png
:align: center
:width: 800

The {ref}`quickstart <quickstart>` pipeline.
```

## Parameterizing pipelines

Pipelines take parameters as input (e.g. the data source connection URL) to vary their behaviour.
{ref}`Jobs <jobs>` can use different parameters to iterate through multiple runs of the same
pipeline. Parameters can be set in the visual pipeline editor.

```{tip}
👉 For secrets, use {ref}`environment variables <environment variables>` since parameters are versioned.
```

## Running a pipeline

```{note}
In this section we will learn what it means to run a pipeline {term}`interactively <interactive
(pipeline) run>`, when to do it, how to do it and what to keep in mind.
```

Once set up, you can run your pipeline in two ways:

- Interactive runs inside the pipeline editor.
- Job runs (see {ref}`job <jobs>`).

Interactive runs are a great way to rapidly prototype your Pipeline. When using Jupyter Notebook
`.ipynb` files, Pipeline steps are actively changed as if running individual cells in JupyterLab.
The output of pipeline steps is stored when you run a step as part of a {term}`session <interactive session>`.
This lets you run just the parts of the Pipeline that you're working rather than the entirety.
You can access these outputs directly from within the JupyterLab kernel for notebook based steps.

## Data passing

Pipelines can pass data between steps. For example, in an ETL pipeline, data can be passed between
individual extract, transform and load steps.

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

Pipeline steps can read and write from and to the `/data` directory. For example:

```python
# Get a text file from some external source.
txt_data = ...

with open("/data/nltk_example_text.txt", "w") as f:
    f.write(txt_data)
```
