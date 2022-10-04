# Miscellaneous appendix

## `/userdir` paths

Overview of the different paths inside the `/userdir`.

```sh
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
│   ├── jupyter-img-builds
│   ├── env-img-builds
│   ├── orchest_examples_data.json
│   ├── orchest_update_info.json
│   ├── celery-*.db (different celery dbs)
│   └── kernels
│       └── <project-uuid>
│           ├── launch_kubernetes.py
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
```

(pipeline-json-schema)=

## Pipeline definition JSON

For an example pipeline definition, check out the `pipeline.orchest` file in our [Quickstart
repo](https://github.com/orchest/quickstart/blob/main/california_housing.orchest).

The full [JSON Schema](https://json-schema.org/) definition of {term}`pipelines <Pipeline definition>`
in Orchest can be found below, alternatively you can see an example and interactive validator
[here](https://www.jsonschemavalidator.net/s/FfQDko01).

```json
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
            "args": {
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
            "exposed": {
              "type": "boolean"
            }
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
```
