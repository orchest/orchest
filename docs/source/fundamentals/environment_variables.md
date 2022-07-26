(environment-variables)=

# Environment variables

```{eval-rst}
.. meta::
   :description: This page contains information about how to use environment variables in Orchest.
```

Environment variables let you exclude sensitive data from the versioning system of your Orchest projects.

Environment variables are injected in your Pipeline Steps, and can be natively retrieved with your chosen language.
For example, in Python:

```python
import os
secret = os.environ["MY_VAR"]
```

You can define environment variables for {ref}`projects`, {ref}`pipelines`, and {ref}`jobs`.

Pipeline variables overwrite Project variables. For example, if `MY_VAR=PROJ_VALUE` is defined at the Project level and `MY_VAR=PIP_VALUE`
at the Pipeline level, the value of `MY_VAR` for an {term}`interactive pipeline runs <interactive (pipeline) run>` is `PIP_VALUE`.

Changes to the `PATH` variable are ignored since they could break code execution.

```{warning}
🚨 Environment variables are persisted within Orchest. Make sure only authorized users can acess
your instance. See how to setup authentication in the {ref}`settings <settings>` section.
```

## Project environment variables

Project environment variables are visible to all pipelines in that respective project (including pipelines in jobs).
Access your project environment variables through project settings:

1. Open the _Projects_ view in the left menu pane.
2. Click on gear icon (in the _settings_ column) in the row representing the project of interest.
3. Towards the top you will find the _Project environment variables_ section.
4. Set your variables.
5. Click the _Save_ button.

## Pipeline environment variables

Access your pipeline environment variables through the pipeline settings:

1. Open a Pipeline via the _Pipelines_ option in the left menu pane.
2. Click on _Settings_ in the top right corner.
3. Click on the _Environment variables_ tab.
4. Set your variables.
5. Click the _Save_ button.

## Job environment variables

Job environment variables are initialized by merging the project and pipeline environment variables when a job is run.
Add to/edit these variables before running the job. Every Pipeline run belonging to this job will include these environment variables.

```{note}
💡 Only recurring scheduled jobs can have their environment variables edited after they have started.
```

## Environment variables inside Notebooks

Environment variables are available in JupyterLab kernels too. Restart the {term}`interactive session <interactive session>` to refresh the kernels' environment variables.
