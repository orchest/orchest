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

You can define Pipeline parameters at two levels:

- Pipelines: The parameters and their values will be available across every Pipeline step.
- Pipeline steps: The parameters will only be available in which they are defined.

### Editing pipeline parameters

1. Open a Pipeline via the _Pipelines_ option in the left menu pane.
2. Click on _SETTINGS_ in the top right corner.
3. Towards the top you will find the _Pipeline parameters_ section.
4. Input some JSON like {code}`{"my-param": <param-value>}`.
5. Make sure to _Save_ at the bottom of your screen.

### Editing pipeline step parameters

1. Open a Pipeline via the _Pipelines_ option in the left menu pane.
2. Click on a Pipeline step to open its _Properties_.
3. Towards the bottom you will find the _Parameters_ section.
4. Input some JSON like {code}`{"my-param": <param-value>}`.

### Interacting with parameters through code

After you have set parameters for your Pipeline and/or steps you can use their values inside your
scripts (see {ref}`parameters API reference <api parameters>`).

Let's say you have set the following parameters on your Pipeline:

```json
{
  "vegetable": "carrot",
  "fruit": "banana"
}
```

And for your Pipeline step:

```json
{
  "candy": "chocolate",
  "fruit": "apple"
}
```

Then inside the Pipeline step you can access the parameters as follows:

```python
import orchest

# Get the parameters of the current step and the pipeline.
fruit = orchest.get_step_param("fruit")               # "apple"
vegetable = orchest.get_pipeline_param("vegetable")   # "carrot"
```

```{tip}
👉 For secrets, use {ref}`environment variables <environment-variables>` since parameters are versioned.
```

### Defining the JSON schema for pipeline parameters

You can further define the schema of the parameters to streamline the process of editing parameters. We integrated an open-source project [JsonForms](https://jsonforms.io/) that allows you to define the types of the parameters.
JsonForms renders the UI form based on the JSON schema, so that you could choose to change the value by interacting
with the UI instead of editing it in the JSON editor. JsonForms provides various [examples](https://jsonforms.io/examples/basic) where you could find the most suitable options for your parameters. This feature were added both in
Pipeline steps and Pipelines.

1. Go to the _Parameters_ section of a Pipeline step.
2. Find the toggle JSON / FORM. Click on FORM.
3. Click on NEW SCHEMA FILE, and it will create a JSON schema file for you and open it in JupyterLab.
4. Right click on the JSON file, select Open With > Editor.
5. Define the schema of the parameters, see the examples from [JsonForms](https://jsonforms.io/examples/basic)
6. Save the JSON schema file.
7. Go back to Visual Pipeline Editor, find the _Parameters_ section of the step you were editing.
8. [Optional] Toggle FORM, in case it was set to JSON.
9. Start editing parameters using the UI form.

[JsonForms](https://jsonforms.io/) has default UI components per data type, e.g. a TextField for string. In case you need more sophisticated layouts or controls, you could create a UI schema file to achieve this (see [JsonForms docs](https://jsonforms.io/docs/uischema/)).

1. Go to the _Parameters_ section of a Pipeline step.
2. Open the More Options menu at the conner.
3. Select New UI schema file, and it will create a JSON schema file for you and open it in JupyterLab.
4. Define the UI schema corresponding to the schema you defined earlier.
5. Go back to Visual Pipeline Editor, find the _Parameters_ section of the step you were editing.
6. [optional] Toggle FORM, in case it was set to JSON.
7. Check if the UI form is updated based on your UI schema.

The JSON schema files are sidecar files of the given step file. The schema files will be picked up if they are in the same folder with specific naming. For example, given a step file of which file path is `source/get-data.py`, the schema file path would be `source/get-data.py.schema.json` and the UI schema file path would be `source/get-data.py.uischema.json`.

The same mechanism also applies to pipeline parameters. You could create the schema files at the _Pipeline_ level.

1. Open a Pipeline via the _Pipelines_ option in the left menu pane.
2. Click on _SETTINGS_ in the top right corner.
3. Towards the top you will find the _Pipeline parameters_ section.
4. Create schema files for the _Pipeline_ with the same steps as for pipeline steps.

Likewise, the schema files are next to the pipeline `.orchest` file, e.g. `california_housing.orchest.schema.json` and `california_housing.orchest.uischema.json`. This means that you could also create these schema files yourself in the file system without the Visual Pipeline Editor.

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
