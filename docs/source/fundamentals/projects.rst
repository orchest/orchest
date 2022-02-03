.. _projects:

Projects
========
.. tip::
   👉 Projects are the core concept in Orchest encapsulating everything else: :ref:`pipelines
   <pipelines>`, :ref:`jobs <jobs>`, :ref:`environments <environments>` and actual user code.

In Orchest a project is essentially just a ``git`` repository, it contains:

* The ``.git`` directory which makes it a ``git`` repository.
* The code, e.g. the Notebook files that are attached to the pipeline steps.
* The :ref:`pipeline definition <pipeline definition>` (check out :ref:`pipelines <pipelines>`) -
  a JSON definition of the pipeline that is visually rendered in the editor. A project can contain
  multiple pipelines.
* The ``.orchest`` directory which should also be versioned as it defines the :ref:`environment
  <environments>` that are used by the project. By versioning them as well, the project runs
  on every machine.

.. code-block:: sh

   .
   ├── .git/
   ├── .orchest
   │   ├── environments/
   │   └── pipelines/
   ├── california_housing.orchest
   ├── collect-results.ipynb
   └── get-data.py

Projects also encapsulate :ref:`jobs <jobs>`. However, these are not stored within in the project on
the filesystem.

Given that a project is a ``git`` repository you might be confused where to write data to, since
git's best practices state that you should not upload large files, just source files. That is indeed
a very good observation. For the use case of storing data locally, all code should store data to the
``/data`` directory. Additionally, secrets should be set using :ref:`environment variables
<environment variables>` as they would otherwise be versioned!

.. note::
   💡 The ``/data`` directory is accessible by all pipelines across all projects, even by jobs.

Inside your code (that run inside :ref:`environments <environments>`) you can access your files
using relative paths. In case your are looking to use absolute path, all files of a project are
mounted to the ``/project-dir`` directory.

Getting started
---------------
.. tip::
   👉 Get started by following the :ref:`quickstart tutorial <quickstart>`.

There are numerous ways to get started on a new project in Orchest, you can:

* Add a new project from scratch.
* Import an existing project using its git repository URL (the same URL you would use to
  ``git clone`` a repo), learn :ref:`how to import a project <how to import a project>`.
* Explore Orchest curated or community contributed examples and importing them.

.. _git inside Orchest:

Using ``git`` inside Orchest
----------------------------
.. tip::
   👉 Would you rather watch a short video tutorial? Check it here: `versioning using git in Orchest
   <https://www.tella.tv/video/cknr9z9x0000709kz7vzh0wdx/view>`_.

Using ``git`` inside Orchest works using the `jupyterlab-git
<https://github.com/jupyterlab/jupyterlab-git>`_ extension which we ship pre-installed. The only
thing that you need to do is :ref:`configure JupyterLab <configuration jupyterlab>` (go to
*settings* > *configure JupyterLab*) and set your ``user.name`` and ``user.email``, for example:

.. code-block:: sh

   git config --global user.name "John Doe"
   git config --global user.email "john@example.org"

If you'd like to add a private SSH key to your terminal session in JupyterLab you can do so
through the following commands:

.. code-block:: sh

   echo "chmod 400 /data/id_rsa" >> ~/.bashrc
   echo "ssh-add /data/id_rsa 2>/dev/null" >> ~/.bashrc
   echo "if [ -z \$SSH_AGENT_PID ]; then exec ssh-agent bash; fi" >> ~/.bashrc
   mkdir -p ~/.ssh
   printf "%s\n" "Host github.com" " IdentityFile /data/id_rsa" >> ~/.ssh/config
   ssh-keyscan -t rsa github.com >> ~/.ssh/known_hosts

Make sure the ``id_rsa`` private key file is uploaded through the file manager (go to *File
manager*) in the root ``data/`` folder.

.. warning::
   🚨 Putting your private key in the ``/data`` folder exposes the private key file to everyone
   using your Orchest instance.

Now you can version using ``git`` through a JupyterLab terminal or use the extension through the
JupyterLab UI.

Importing private ``git`` repositories
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
To import private ``git`` repositories upload them directly through the *File manager* into the
root ``projects/`` directory. Orchest will then pick up the project automatically.
