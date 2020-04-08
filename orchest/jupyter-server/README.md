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
docker run --name mytest -p 8888:8888 -p 80:80 -v /Users/yannick/Documents/experiments:/notebooks jupyter-server:latest
```

## Running in Development
To run the flask application in development, please change the following two settings in their
respective configuration files:
* `app/config.py`: Set `CONFIG_CLASS = DevelopmentConfig`.
* `app/app/core/config.py`: Set `PRODUCTION = False`.

Next it is advised to create a virtualenv at the root directory `jupyter-server/`, because otherwise
the virtualenvironment will be copied into the docker container when building the Dockerfile. Use
the `app/requirements.txt` like so `pip install -r app/requirements.txt` (after activating your
virtualenv).

Test can be run inside `app/` using `python -m pytest`.


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
│   │   └── tmp
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

## TODO
- [ ] Fix the tests! They should be cleaner than they are now. Also make sure the comments and
    documentation are on point. Add things to the `tests/README.md`.
- [ ] Create `/app/errors/` with `__init__.py` and `handlers.py` to create the blueprints and handle
    the errors respectively. See this one https://flask-restplus.readthedocs.io/en/stable/errors.html
    for examples of handlers.
- [ ] Since this will be running inside a docker container we need a good stacktrace.
- [ ] Logging
- [ ] Currently, the `connection_file` is stored at a hardcoded location. Put this location in a
    config.
- [ ] Maybe it is possible to set an ENV variable to determine where the Jupyter `connection_file`
    is written instead of using their internal functions. The latter is more susceptible to erros in
    the future if their internal framework changes. Although for now this does not seem that
    important. I don't thinkt the Jupyter ecosystem will change this much that (ever possibly).
- [X] When it comes to the loading the `config.py` in the `main.py` it should use the `from_pyfile`
    instead. Additionally, it could load `from_envvar("SOME_VAR_TO_DISABLE_DEBUG")` which is only
    set in the Dockerfile. This way, when building the Dockerfile, DEBUG is always set to False and
    during development always to True. Have a look https://flask.palletsprojects.com/en/1.1.x/config/
- [X] How exactly does everything work with the `__init__.py` file. When is it called and where
    should it be placed? 
    Then what is this: https://github.com/timbrel/GitSavvy/issues/626
- [X] I should put environment variables into the docker container. For example the notebook
    directory. Then I can set one for testing (without docker) and one for inside the container
    (which can be hardcoded to "/notebooks", since the files are always mounted there)
- [X] Testing with Flask https://flask.palletsprojects.com/en/1.1.x/testing/ I think it is best to
    create the factory application. Then call the `create_app` and then do `app.test_client()`
- [X] Exclude the `app/tests` directory in the Dockerfile, because this is not perse needed to run
    the application inside a container. This is so lightweight. I think I can just leave it there
    for the time being.
- [X] Elaborate more on the project structure. Would be great to know on a high level what every
    file does and why it is there.
- [X] Fix the configuration such that it knows what the NOTEBOOK_DIR is when in docker (thus
    production) and when in development.

