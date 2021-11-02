Implementation details
======================

Best practices
--------------

When adding new code to the repository, try to stick to the following best practices (WIP):

* New endpoints, e.g. in the ``orchest-api`` or proxy in the ``orchest-webserver``, should **NOT**
  end with trailing slashes. For example, go with ``/api/jobs`` (good) over ``/api/jobs/`` (bad).
* **Don't** use class components **do** use functional components.

Topics
------

``userdir/`` paths
~~~~~~~~~~~~~~~~~~
Overview of the different paths inside the ``userdir/``.

.. code-block:: bash

   .
   ├── data/
   ├── jobs
   │   └── <project-uuid>
   │       └── <pipeline-uuid>
   │           └── <job-uuid>
   │               ├── <noninteractive-run-uuid>
   │               │   └── <copy-myproject-state-after-job>
   │               └── snapshot
   │                   └── <complete-copy-of-myproject>
   ├── .orchest
   │   ├── user-configurations
   │   │   └── jupyterlab
   │   │       └── <various configuration files>
   │   ├── database
   │   │   └── data
   │   │       └── <postgres data store>
   │   └── kernels
   │       └── <project-uuid>
   │           ├── launch_docker.py
   │           └── orchest-env-<project-uuid>-<env-uuid>
   │               └── kernel.json
   └── projects
       └── myproject
           ├── mypipe.orchest
           ├── .orchest
           │   ├── pipelines
           │   │   └── <pipeline-uuid>
           │   │       ├── logs
           │   │       │   └── <pipeline-step-uuid>.log
           │   │       │   └── <service-name>.log
           │   │       └── data
           │   │           ├── <pipeline-step-uuid>.<serialization>
           │   │           └── HEAD
           │   ├── environments
           │   │   └── <env-uuid>
           │   │       ├── properties.json
           │   │       └── setup_script.sh
           │   └── .gitignore
           └── preprocessing.ipynb


.. _pipeline-json-schema:

Pipeline definition JSON
~~~~~~~~~~~~~~~~~~~~~~~~

The full `JSON Schema <https://json-schema.org/>`_ definition of :ref:`pipelines <pipeline
definition>` in Orchest can be found below.

You can see an example and interactive validator `here <https://www.jsonschemavalidator.net/s/FfQDko01>`_.

Check out an example `pipeline.orchest` file in our `Quickstart repo <https://github.com/orchest/quickstart/blob/main/california_housing.orchest>`_.

Full JSON Schema:

.. code-block:: json

  {
    "$id": "http://orchest.io/schemas/pipeline/1.0.0.json",
    "$schema": "http://json-schema.org/schema#",
    "definitions": {
      "parameter": {
        "propertyNames": {
          "type": "string"
        },
        "type": "object"
      },
      "uuidv4": {
        "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
        "type": "string"
      }
    },
    "properties": {
      "name": {
        "type": "string"
      },
      "parameters": {
        "$ref": "#/definitions/parameter"
      },
      "settings": {
        "properties": {
          "auto_eviction": {
            "type": "boolean"
          },
          "data_passing_memory_size": {
            "type": "string"
          }
        },
        "type": "object"
      },
      "steps": {
        "additionalProperties": false,
        "patternProperties": {
          "": {
            "properties": {
              "environment": {
                "$ref": "#/definitions/uuidv4"
              },
              "file_path": {
                "type": "string"
              },
              "incoming_connections": {
                "items": {
                  "$ref": "#/definitions/uuidv4"
                },
                "type": "array"
              },
              "kernel": {
                "properties": {
                  "display_name": {
                    "type": "string"
                  },
                  "name": {
                    "type": "string"
                  }
                },
                "required": [
                  "display_name",
                  "name"
                ],
                "type": "object"
              },
              "meta_data": {
                "properties": {
                  "hidden": {
                    "type": "boolean"
                  },
                  "position": {
                    "items": {
                      "type": "number"
                    },
                    "type": "array"
                  }
                },
                "type": "object"
              },
              "parameters": {
                "$ref": "#/definitions/parameter"
              },
              "title": {
                "type": "string"
              },
              "uuid": {
                "$ref": "#/definitions/uuidv4"
              }
            },
            "required": [
              "uuid",
              "title",
              "parameters",
              "kernel",
              "incoming_connections",
              "file_path",
              "environment"
            ],
            "type": "object"
          }
        },
        "propertyNames": {
          "$ref": "#/definitions/uuidv4"
        },
        "type": "object"
      },
      "services": {
        "additionalProperties": false,
        "patternProperties": {
          "": {
            "additionalProperties": false,
            "properties": {
              "image": {
                "type": "string"
              },
              "name": {
                "type": "string"
              },
              "command": {
                "type": "string"
              },
              "entrypoint": {
                "type": "string"
              },
              "scope": {
                "items": {
                  "type": "string"
                },
                "type": "array"
              },
              "binds": {
                "properties": {
                  "": {
                    "type": "string"
                  }
                },
                "type": "object"
              },
              "env_variables": {
                "properties": {
                  "": {
                    "type": "string"
                  }
                },
                "type": "object"
              },
              "env_variables_inherit": {
                "items": {
                  "type": "string"
                },
                "type": "array"
              },
              "ports": {
                "items": {
                  "type": [
                    "string",
                    "number"
                  ]
                },
                "type": "array"
              },
              "preserve_base_path": {
                "type": "boolean"
              },
              "requires_authentication": {
                "type": "boolean"
              }
            },
            "required": [
              "image",
              "name",
              "scope"
            ],
            "type": "object"
          }
        },
        "propertyNames": {
          "type": "string"
        },
        "type": "object"
      },
      "uuid": {
        "$ref": "#/definitions/uuidv4"
      },
      "version": {
        "type": "string"
      }
    },
    "required": [
      "name",
      "settings",
      "steps",
      "version"
    ],
    "type": "object"
  }

ENV variables
~~~~~~~~~~~~~
When it comes to pipeline execution, each pipeline step is executed in its own environment. More
particularly in its own container. Depending on how the code inside a pipeline step is executed a
number of ENV variables are set by Orchest. The different ways to execute code as part of a pipeline
step are:

* Running the cell of a Jupyter Notebook in JupyterLab,
* Running an interactive run through the pipeline editor,
* Running a non-interactive run as part of a job.

In all of the above mentioned cases the following ENV variables set: ``ORCHEST_PROJECT_UUID``,
``ORCHEST_PIPELINE_UUID`` and ``ORCHEST_PIPELINE_PATH``. Then there is ``ORCHEST_STEP_UUID``, which is
used for data passing, this ENV variable is always present in (non-)interactive runs and in the
Jupyter Notebooks after the first data passing using the :ref:`Orchest SDK`. Additionally, you can
use the following code snippet to get the UUID of the step if it is not yet set inside the
environment:

.. code-block:: python

    import json
    import orchest

    # Put in the relative path to the pipeline file.
    with open("pipeline.orchest", "r") as f:
        desc = json.load(f)

    p = orchest.pipeline.Pipeline.from_json(desc)
    step_uuid = orchest.utils.get_step_uuid(p)

Lastly, there are ``ORCHEST_MEMORY_EVICTION`` and ``ORCHEST_HOST_PROJECT_DIR``. The former is never
present when running notebooks interactively and otherwise always present, this means eviction of
objects from memory can never be triggered when running notebooks interactively. The latter is used
to make the entire project directory available through the JupyterLab UI and is thus only set for
interactive Jupyter kernels.

SDK data passing
~~~~~~~~~~~~~~~~
The :meth:`orchest.transfer.get_inputs` method calls :meth:`orchest.transfer.resolve` which, in
order to resolve what output data the user most likely wants to get, needs a timestamp of the most
recent output for every transfer type. E.g. if some step outputs to disk at 1pm and later outputs to
memory at 2pm, then it is very likely that output data should be retrieved from memory. Therefore,
we adhere to a certain "protocol" for transfers through disk and memory as can be read below.

Disk transfer
"""""""""""""
To be able to resolve the timestamp of the most recent write, we keep a file called ``HEAD`` for
every step. It has the following content: ``timestamp, serialization``, where timestamp is specified
in isoformat with timespec in seconds.


Memory transfer
"""""""""""""""
When data is put inside the store it is given metadata stating either its serialization or (in case
of an empty message for eviction) the source and target of the output that is stored.

All metadata has to be in `bytes`, where we use the following encoding:

* ``1;serialization`` where serialization is one of ``["arrow", "arrowpickle"]``.
* ``2;source,target`` where source and target are both UUIDs of the respective steps.

Writing tests
~~~~~~~~~~~~~

Orchest includes a selection of `custom commands
<https://docs.cypress.io/api/cypress-api/custom-commands#Parent-Commands>`_ to ease the writing of
tests:

* ``cy.setOnboardingCompleted(<value>)``
   override the local storage value for whether or not to display the Onboarding Dialog.
* ``cy.getOnboardingCompleted()``
   get the local storage value for whether or not the Onboarding Dialog has been completed.

As well as:

- `Cypress LocalStorage Commands <https://github.com/javierbrea/cypress-localstorage-commands>`_
- `Cypress Testing Library <https://testing-library.com/docs/cypress-testing-library/intro/>`_

Querying Elements
"""""""""""""""""

**Don't** query for specific content, HTML structure or CSS selectors – these methods are brittle
and prone to change.

**Do** use the ``data-test-id`` attribute.

.. code:: html

    <div data-test-id="some-test-id">Content to test</div>

.. code:: ts

    cy.findByTestId("some-test-id").should("exist");

Grouping
""""""""

Organizing tests can be tricky – think of the `test interface
<https://docs.cypress.io/guides/core-concepts/writing-and-organizing-tests#Test-Structure>`_
like a directory tree:

* ``describe()`` – the top-level user-journey or business logic.

   * ``context()`` – shared/similar behavior patterns.

      * ``it()`` – individual/use-case behavior.

Inside each level, make use of hooks to run `shared checks and cleanup
<https://docs.cypress.io/guides/core-concepts/writing-and-organizing-tests#Hooks>`_.

.. tip::
   **For example;** if you're testing a Dialog component, you may want to group various "close" actions
   inside a ``context()``. Inside that ``context()``, an ``afterEach()`` hook could be used to assert
   the Dialog is no longer visible.

Debugging
"""""""""

By default, Cypress operates as fast as the browser can go – this can make it difficult to debug
tests during development.

To make things easier, try:

* Using ``.only`` to run only the specified step.
* Using ``cy.wait(<ms>)`` to slow steps down arbitrarily.

(Just make sure not to commit these!)
