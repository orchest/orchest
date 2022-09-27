(projects)=

# Projects

```{eval-rst}
.. meta::
   :description: This page contains information about how to create and use projects in Orchest.
```

A **project** is the main container for organizing related {ref}`pipelines <pipelines>`, {ref}`jobs <jobs>`, {ref}`environments <environments>` and code in Orchest.

A project is based on a `git` repository. For example, a Project might be organized like:

```sh
.
├── .git/
├── .orchest
│   ├── environments/
│   └── pipelines/
├── california_housing.orchest
├── collect-results.ipynb
└── get-data.py
```

Projects also contain {ref}`jobs <jobs>`, however, these are not stored in the project filesystem.

You can access project files in your code running inside {ref}`environments <environments>` using relative paths.
For absolute paths, all files of a project are mounted to the `/project-dir` directory.

## Getting started with projects in Orchest

You can get started with Projects by:

- Creating a new Project
- Importing an existing Project
- Importing Orchest curated or community contributed examples through the _Projects_ page.

```{tip}
👉 See {ref}`quickstart tutorial <quickstart>`.
```

(how-to-import-a-project)=

## Importing a project

To import an existing Project into Orchest: open the _Project_ dropdown menu and click the _import_ button.

```{figure} ../img/project-import.png
:align: center
:alt: Importing a project in Orchest.
:width: 400
```

```{tip}
👉 See video tutorial: [importing a project].
```

[importing a project]: https://www.tella.tv/video/cknr7of9c000409jr5gx4efjy/view

## Project versioning

A Project's `.orchest` directory should be versioned since it defines the {ref}`Environments <environments>` the Project uses. This enables the Project to run on every machine.

The `/data` directory can be used to store data locally that is accessible by all Pipelines across
all Projects, even by {ref}`Jobs <jobs>`.

Secrets on te other hand, should be set with {ref}`environment variables <environment-variables>` to
avoid them being versioned.

(git-inside-orchest)=

## Using `git` inside Orchest projects

```{tip}
👉 See video tutorial: [versioning using git in Orchest](https://www.tella.tv/video/cknr9z9x0000709kz7vzh0wdx/view).
```

You can use `git` inside Orchest with the pre-installed [jupyterlab-git](https://github.com/jupyterlab/jupyterlab-git) extension.
Get started by adding your `user.name` and `user.email` in {ref}`configure JupyterLab <configuration-jupyterlab>`. For example:

```sh
git config --global user.name "John Doe"
git config --global user.email "john@example.org"
```

Use the following command to add a private SSH key to your terminal session in JupyterLab:

```sh
echo "chmod 400 /data/id_rsa" >> ~/.bashrc
echo "ssh-add /data/id_rsa 2>/dev/null" >> ~/.bashrc
echo "if [ -z \$SSH_AGENT_PID ]; then exec ssh-agent bash -c 'shellspawner; bash'; fi" >> ~/.bashrc
mkdir -p ~/.ssh
printf "%s\n" "Host github.com" " IdentityFile /data/id_rsa" >> ~/.ssh/config
ssh-keyscan -t rsa github.com >> ~/.ssh/known_hosts
```

Ensure the `id_rsa` private key file is uploaded through the pipeline file manager in the `data/` folder.

```{warning}
🚨 Adding a private key file to the `/data` folder exposes it to everyone using your Orchest instance.
```

You can then version using `git` using:

- JupyterLab terminal.
- JupyterLab git extension UI.
