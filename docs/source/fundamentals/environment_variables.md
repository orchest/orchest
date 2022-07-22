(environment-variables)=

# Environment variables

Environment variables let you exclude sensitive data from your versioning system.

Environment variables are injected in your pipeline steps, and can be natively retrieved with your chosen language. For example, in Python:

```python
import os
secret = os.environ["MY_VAR"]
```

You can define environment variables for Projects, Pipelines and Jobs.

Pipeline variables overwrite Project variables. For example, if `MY_VAR=PROJ_VALUE` is defined at the Project level and `MY_VAR=PIP_VALUE`
at the Pipeline level, the value of `MY_VAR` for an {term}`interactive pipeline runs <interactive (pipeline) run>` is `PIP_VALUE`.

Changes to the `PATH` variable are ignored since they could break code execution.

```{warning}
🚨 Environment variables are persisted within Orchest. Make sure only authorized users can acess
your instance. See how to setup authentication in the {ref}`settings <settings>` section.
```

## Project environment variables

Project environment variables are visible to all Pipelines in that respective Project (including Pipelines in Jobs). Access your Project environment variables through Project settings:

1. Open the _Projects_ view in the left menu pane.
2. Click on gear icon (in the _settings_ column) in the row representing the project of interest.
3. Towards the top you will find the _Project environment variables_ section.
4. Set your variables.
5. Click the _Save_ button.

## Pipeline environment variables

Access your Pipeline environment variables through the Pipeline settings:

1. Open a Pipeline via the _Pipelines_ option in the left menu pane.
2. Click on _Settings_ in the top right corner.
3. Click on the _Environment variables_ tab.
4. Set your variables.
5. Click the _Save_ button.

## Job environment variables

Job environment variables are initialized by merging the Project and Pipeline environment variables when a Job is run. Add to/edit these variables before running the Job. Every Pipeline run belonging to this Job will include these environment variables.

```{note}
💡 Only recurring scheduled jobs can have their environment variables edited after they have started.
```

## Environment variables inside Notebooks

Environment variables are available in JupyterLab kernels too. Restart the {term}`interactive session <interactive session>` to refresh the kernels' environment variables.
