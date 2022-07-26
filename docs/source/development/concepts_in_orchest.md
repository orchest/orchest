# Concepts in Orchest

This document tries to explain "How Orchest works".

## High-level overview

From a high-level standpoint, all the pages in Orchest are just "views" on files on the filesystem.
For example, Pipelines that are shown in the pipeline editor are just JSON files under the hood (see
the {ref}`Pipeline JSON schema <pipeline-json-schema>`).

```{image} ../img/pipeline.png
:width: 400
:alt: A Pipeline in the pipeline editor
:align: center
```

## Concepts

Before getting into the core concepts in Orchest, it is good to realize that Orchest is a fully
containerized application that runs on a Kubernetes cluster. This means that all code that is
executed is executed within a container, this includes user code!

Projects
: Dedicated section: {ref}`Projects`.

    Apart from global settings and authentication, everything in Orchest is encapsulated by
    Projects. You can think of a Project as a folder on your filesystem that contains a bunch of
    Files, some of which are "special" (hinting at Pipeline files with a `.orchest` extension). In
    addition to the filesystem state, Orchest saves state in a database. This state includes things
    such as {ref}`environment variables <environment-variables>`.

    ```{image} ../img/concepts/Project.png
    :width: 200
    :alt: Concept of a Project in Orchest
    :align: center
    ```

Files
: Within a Project there can be any number of files. In the context of Orchest, these tend to be
executable files, such as: Python files, Notebooks and R files. Nothing special here!

    ```{image} ../img/concepts/Files.png
    :width: 200
    :alt: Concept of Step Files in Orchest
    :align: center
    ```

Pipelines
: Dedicated section: {ref}`Pipelines`.

    Glossary: {term}`Pipelines <(data science) pipeline>`.

    Another important concept in Orchest are Pipelines. A Pipeline can be constructed by connecting
    multiple Steps (the smallest unit of execution in Orchest), which determines the order of
    execution of those Steps. Moreover, you can {ref}`pass data <data passing>` between connected
    Steps to continue working on resulting data.

    A Pipeline's full description is stored in a single JSON file (called the
    {term}`pipeline definition`). This means that Pipelines can be fully versioned as well so you
    can track of any changes that are made to them.

    ```{image} ../img/concepts/Pipeline.png
    :width: 200
    :alt: Concept of a Pipeline in Orchest
    :align: center
    ```

Steps
: Glossary: {term}`Steps <pipeline step>`.

    As was noted in the previous section about Pipelines; a Step is the smallest unit of execution
    in Orchest. As part of a Step you can configure: (1) the File you want to execute, and (2) the
    Environment (just a container) to execute the File in. Remember, Orchest is a fully
    containerized application.

    Steps execute your code and thus give you full flexibility of what you want to achieve!

    ```{image} ../img/concepts/Step.png
    :width: 200
    :alt: Concept of Pipeline Steps in Orchest
    :align: center
    ```

Environments
: Dedicated section: {ref}`Environments`.

    Glossary: {term}`Environments <environment>`.

    Because Orchest is a fully containerized application, all your code needs to run in a dedicated
    container. Combined with the fact that code can depend on additional dependencies (who hasn't
    used a library before) the container (the underlying image to be more precise) needs to be
    configured to your needs. In Orchest we let you fully customize your container images using a
    set-up script, which we then automatically build for you. This is what we call an Environment.

    ```{image} ../img/concepts/Environments.png
    :width: 200
    :alt: Concept of Environments in Orchest
    :align: center
    ```

Jobs
: Dedicated section: {ref}`Jobs`.

    Glossary: {term}`job`.

    After you have created your Pipeline, coded your Files, configured your Steps and set up your
    Environments, you inevitably want to be running your Pipeline. In Orchest, this can be done by
    running a Pipeline inside the pipeline editor (called an
    {term}`interactive run <interactive (pipeline) run>`) or through Jobs. The former allows for
    easy testing whilst you are developing your Pipeline and the latter (Jobs) let you run your
    Pipeline in productuction on a recurring schedule (e.g. daily).

    ```{image} ../img/concepts/Job.png
    :width: 200
    :alt: Concept of a Job in Orchest
    :align: center
    ```

## Putting it all together

Now that you are familiar with the core concepts in Orchest, lets look at the file structure of an
example Project called `myproject`:

```bash
myproject
    ├── .git/
    ├── .gitignore
    ├── .orchest
    │   └── environments/
    ├── pipeline.orchest
    ├── step-1.ipynb
    └── step-2.py
```

Things we can see here:

- `.git/` means that the Project is versioned using `git`.
- `.orchest/environments` contains the set-up of Environments. Yes, they are fully versioned as well
  so that your Project fully encapsulates all dependencies!
- `pipeline.orchest` is the Pipeline of the Project, consisting of `step-1.ipynb` and `step-2.py`.
