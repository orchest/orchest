(quickstart)=

# Quickstart tutorial

```{eval-rst}
.. meta::
   :description: This page contains the quickstart tutorial for Orchest with steps to quickly get started with Orchest.
```

This quickstart follows an example explaining how to build data science pipelines in Orchest and
touches upon some core principles that will be helpful when you get to building your own pipelines.
The example Pipeline will download the [sklearn California housing dataset], explore the data,
train some classifiers, and in the final step collect the results from those classifiers.

[sklearn california housing dataset]: https://scikit-learn.org/stable/modules/generated/sklearn.datasets.fetch_california_housing.html

```{figure} ../img/quickstart/final-pipeline.png
:align: center
:width: 800
:alt: The resulting Pipeline from this Orchest quickstart

The resulting Pipeline from this quickstart.
```

```{tip}
👉 Building data pipelines in Orchest is easy! Check out our [introductory video](https://vimeo.com/764866337).
```

(impatient)=

## For the impatient

As [Miguel Grinberg](https://blog.miguelgrinberg.com/index) would say: "If you are the instant
gratification type, and the screenshot at the top of this article intrigued you, then head over to
the [Github repository](https://github.com/orchest/quickstart) for the code used in this article.
Then come back to learn how everything works!"

To get started in Orchest you can import the "Quickstart Pipeline" example Project through the UI:

```{figure} ../img/quickstart/import-project.png
:align: center
:width: 800
:alt: Import existing project in Orchest
```

## Create your first Project in Orchest

To start, make sure you have {ref}`installed Orchest <regular-installation>` or go to your [Orchest
Cloud](https://cloud.orchest.io/) account. Next, create a new {ref}`Project <projects>` named
`quickstart`. After creating the Project, you will automatically be taken to the Pipeline editor.
Note that Orchest has created an empty default {term}`Pipeline <(Data science) pipeline>` for you,
called `main.orchest`.

```{figure} ../img/quickstart/project-creation.png
:align: center
:width: 800
:alt: Empty Pipeline editor in Orchest.
```

```{note}
All code in this quickstart is written in Python, nevertheless, Orchest also supports other
languages such as R.
```

## Get California housing data

After creating the Project, it is still empty. Let's create a _new file_ to start building your
Pipeline. Name your file `get-data` and choose the `.py` extension. Make sure to check the
_Create a new step for this file_ box to automatically create a Step for the file:

```{figure} ../img/quickstart/file-creation.png
:align: center
:width: 500
:alt: Creating a file in the Pipeline editor.
```

```{note}
The changes you make to the Pipeline (through the Pipeline editor) are saved automatically.
```

Now you can start writing some code through the familiar JupyterLab interface, simply press _edit in
JupyterLab_ and paste in the following code:

```{code-block} python
:emphasize-lines: 2, 3, 11, 19
:linenos: true

import orchest
import pandas as pd
from sklearn import datasets

# Explicitly cache the data in the "/data" directory since the
# kernel is running in a container, which are stateless.
# The "/data" directory is a special directory managed by Orchest
# to allow data to be persisted and shared across pipelines and
# even projects.
print("Dowloading California housing data...")
data = datasets.fetch_california_housing(data_home="/data")

# Convert the data into a DataFrame.
df_data = pd.DataFrame(data["data"], columns=data["feature_names"])
df_target = pd.DataFrame(data["target"], columns=["MedHouseVal"])

# Output the housing data so the next steps can retrieve it.
print("Outputting converted housing data...")
orchest.output((df_data, df_target), name="data")
print("Success!")
```

A few lines in the code above are highlighted to emphasize important nuts and bolts to
get a better understanding of building pipelines in Orchest. These nuts and bolts are explained
below:

> Line `2` and `3` import third-party packages that need to be installed in the {ref}`Environment <environments>`. Environments define the execution environment in which your scripts are executed.
> To install `pandas` and `sklearn` simply head over to the _Environments_ tab, add
> `pip install pandas sklearn` to the _setup script_ and press _Build_. That is all it takes to
> build a container under the hood in which your script will be executed!
>
> Line `11` caches the data in the `/data` directory. This is actually the `userdir/data` directory
> (from the Orchest GitHub repository) that gets mounted in the respective container running your code.
> This allows you to access the data from any pipeline, even from pipelines in different projects.
> Data should be stored in `/data` not only for sharing purposes, but also to make sure that {ref}`jobs <jobs>`
> do not unnecessarily copy the data when creating the snapshot for reproducibility reasons.
>
> Lastly, line `19` showcases the usage of the {ref}`Orchest SDK <orchest sdk>` to
> {ref}`pass data between pipeline steps <data passing>`. Keep in mind that calling
> {meth}`orchest.transfer.output` multiple times will result in the data getting overwritten,
> in other words: only output data once per step!

To run the code, switch back to the Pipeline editor and press _run all_. After just a few seconds
you should see that the Step completed successfully. Select the Step and check the logs to confirm -
they contain the latest STDOUT of the `get-data.py` script.

```{figure} ../img/quickstart/step-logs.png
:align: center
:width: 400
:alt: Step logs of an Orchest Pipeline
```

Remember that running the code will output the converted housing data, so in the next Step you can
now retrieve and explore that data!

## Data exploration

Now that you have downloaded the data, the next Pipeline Step can explore it. Create another file
called `explore-data.ipynb` (again make sure to check the box to automatically create a Step for
it), and connect the two Pipeline Steps.

```{figure} ../img/quickstart/pipeline-two-steps.png
:align: center
:width: 400
:alt: Pipeline with two steps in Orchest
```

You can get the code for this Pipeline Step from the `explore-data.ipynb` [file in the GitHub
repository](https://github.com/orchest/quickstart/blob/main/explore-data.ipynb) by copy-pasting the
code, or using the _upload file_ functionality from the built-in file-manager:

```{figure} ../img/quickstart/upload-file.png
:align: center
:width: 400
:alt: File-manager actions
```

## Finalizing the pipeline

To end up with the final Pipeline, please refer to the {ref}`For the impatient <impatient>` section
to import the Pipeline. You can also build the Pipeline from scratch yourself!

```{figure} ../img/quickstart/final-pipeline-completed.png
:align: center
:width: 800
:alt: Successful Pipeline run of the final Pipeline in Orchest

A successful Pipeline run of the final Pipeline.
```

```{note}
The {term}`interactive session <Interactive session>` does not shut down automatically and thus the
resources will keep running when editing another Pipeline, you can shut down the session manually
by clicking the toggle button in the *Pipeline sessions* section in the Pipeline editor.
```
