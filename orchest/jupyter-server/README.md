# jupyter-server 

Naming convention: The container running the Jupyter server process (the JupyterLab instance) is
called `jupyter-server`.

Inside the docker container there are two potential running processes
* Flask API (at port 80). This API is always running.
* Jupyter server process (at port 8888). Only runs when started via a POST request to the Flask API.

Example POST request to the `jupyter-server` API
```
{
  "gateway-url": "http://0.0.0.0:8888",
}
```


## Docker
Note that the `jupyter_notebook_config.py` is copied into the container. This overwrites the
configuration used by the Jupyter server.

Commands to build and run the docker container
```bash
# Build the container from the Dockerfile
docker build -t "jupyter-server" .

# Remove containers such that the name "mytest" can be used
docker rm $(docker ps -a -q) 

# Run the container and publish the ports for the API and JupyterLab instance
docker run --name jupyter-server -p 8888:8888 -p 80:80 -v <mount-path>:/notebooks jupyter-server
```

## Running in Development
To run the flask application in development, please change the following two settings in their
respective configuration files:
* `app/config.py`: Set `CONFIG_CLASS = DevelopmentConfig`.
* `app/app/core/config.py`: Set `PRODUCTION = False`.

Next it is advised to create a virtualenv at the root directory `jupyter-server/` called `venv` (to
be ignored by the `.gitignore`), because otherwise the virtualenvironment will be copied into the
docker container when building the Dockerfile. Use the `app/requirements.txt` like so `pip install
-r app/requirements.txt` (after activating your virtualenv).

Tests can be run inside `app/` using `python -m pytest`.


## Explanation of project structure
The structure is as follows (generated using `tree -A -I "venv|__pycache__"`)
```bash
.
├── app
│   ├── app
│   │   ├── apis
│   │   │   └── ...
│   │   ├── core
│   │   │   └── ...
│   │   ├── __init__.py
│   │   ├── tmp
│   │   └── utils.py
│   ├── config.py
│   ├── main.py
│   ├── README.md
│   ├── requirements.txt
│   └── tests
│       └── ...
├── Dockerfile
├── jupyter_notebook_config.py
└── README.md
```
A short explanation of certain directories and files:
* `.`: create your virtualenv here with the `app/requirements.txt`
* `app/`: the base image of the Dockerfile requires a `app/main.py`. To additionally use the Flask
    Application Factory pattern (using a `create_app` function in the `__init__.py` that returns a
    configured app instance - useful for testing), everything is put in the `app/` directory.
* `app/main.py`: this file is used to start the Flask application with the `app/config.py` as
    configuration.
* `app/app/`: the Flask application code.
* `app/tests/`: tests for the Flask application. This uses its own configuration object (exactly why
    this entire structure was chosen, because without the application factory pattern this is not
    possible without side effects).


## notebook-patch
In order to make the notebook gateway kernel connect through the nginx proxy we patched the websocket handler in the notebook package (notebook/gateway/handlers.py). We override the check_origin method as per tornado framework instruction to allow varying origins. This might introduce a security issue, but I think it's mitigated by the Docker network not being exposed.