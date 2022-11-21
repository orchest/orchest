# FAQ

## How to install new packages?

```{tip}
👉 Would you rather watch a short video tutorial? Check it our here: [installing additional
packages](https://app.tella.tv/story/cknr8owf4000308kzalsk11a5).
```

To install new packages, you should make use of {ref}`environments <environments>`. Simply build a
new environment that contains your package and select it inside the pipeline editor. Installing
packages is done using well known commands such as `pip install` and `sudo apt-get install`.

```{note}
💡 When updating an existing environment, the new environment will automatically be used inside
the visual editor (and for your {term}`interactive pipeline runs <interactive (pipeline) run>`).
However, the JupyterLab kernel needs to be restarted if it was already running.
```

### What not to do

Do **not** install new packages by running bash commands inside the Notebooks. This will require the
packages to be installed every time you do a pipeline run, since the state of the kernel environment
is ephemeral.

## How to share code between steps?

```{note}
💡 This approach also works to share code between pipelines.
```

There are multiple answers to this question. One being that you can make that code into a package
which you can then install in your environment, just like other packages such as `numpy`. Of
course the development cycle would be highly reduced with this approach and so an alternative would
be to add the files to the project directory directly and import them in your scripts.

For example, you could create a `utils.py` file in your project directory and use its functions
from within your scripts by:

```python
import utils

utils.transform(...)
```

## How to minimize Orchest's disk size?

To keep Orchest's disk footprint to a minimal you can use the following best practices:

- Are you persisting data to disk? Then write it to the `/data` directory instead of the project
  directory. {ref}`Jobs <jobs>` create a snapshot (for reproducibility reasons) of your project
  directory and would copy data in your project directory for every pipeline run, consuming large
  amounts of storage. The smaller the size of your project directory, the smaller the size of your
  jobs.
- Do you have many pipeline runs as part of jobs? You can configure your job to only retain a
  number of pipeline runs and automatically delete the older ones. Steps: (1) edit an existing job
  or create a new one, (2) go to _pipeline runs_, and (3) select _auto clean-up_.

## How to use a GPU in Orchest?

Currently GPU support is not yet available. Coming soon! See
[#1280](https://github.com/orchest/orchest/issues/1280).

(skip-notebook-cells)=

## How to skip notebook cells?

Notebooks facilitate an experimental workflow, meaning that there will be cells that should not be
run when executing the notebook (from top to bottom). Since {term}`pipeline runs <pipeline run>`
require your notebooks to be executable, Orchest provides an (pre-installed JupyterLab) extension
to skip those cells.

To skip a cell during pipeline runs:

1. Open JupyterLab.
2. Go to the _Property Inspector_, this is the icon with the two gears all the way at the right.
3. Select the cell you want to skip and give it a tag of: _skip_.

The cells with the _skip_ tag are still runnable through JupyterLab, but when executing these
notebooks as part of pipelines in Orchest they will not be run.

## I'm getting `ModuleNotFoundError: No module named` exceptions even after declaring my dependencies

If you are getting weird `ModuleNotFoundError` exceptions
for libraries that supposedly you declared already,
there is a chance that you might have reinstalled `ipykernel` with `pip`,
[which causes a known incompatibility].
There are two ways to fix this issue:

1. Add `python -m ipykernel install --sys-prefix` at the end of your setup script,
   which restores the paths `ipykernel` needs to work.
2. Use mamba (or conda) instead of pip to install your dependencies,
   which avoid this incompatibility.

[which causes a known incompatibility]: https://github.com/orchest/orchest/issues/425
