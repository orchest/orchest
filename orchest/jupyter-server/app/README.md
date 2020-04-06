# jupyter-server
Naming convention
* The container running the Jupyter server process (the JupyterLab instance) is called `jupyter-server`.

Inside the docker container there are two potential running processes
* Flask API (at port 80). This API is always running.
* Jupyter server process (at port 8888). Only runs when started via a POST request to the Flask API.

Example POST request to the `jupyter-server` API
```
{
  "gateway-url": "http://0.0.0.0:8888",
}
```

Commands to build and run the docker container
```bash
# Build the container from the Dockerfile
docker build -t "jupyter-server" .

# Remove containers such that the name "mytest" can be used
docker rm $(docker ps -a -q) 

# Run the container and publish the ports for the API and JupyterLab instance
docker run --name mytest -p 8888:8888 -p 80:80 -v /Users/yannick/Documents/projects/Orchest/notebooks:/notebooks jupyter-server:latest
```

## Dockerfile
Note that the `jupyter_notebook_config.py` is copied into the container. This overwrites the
configuration used by the Jupyter server.


## Implementation details
Connecting to a JupyterLab instance requires to know its networking information and secret token,
which can be found in the `server_info`, e.g.:
```json
{
    'base_url': '/',
    'hostname': 'localhost',
    'notebook_dir': '/notebooks',
    'password': False,
    'pid': 94619,
    'port': 8888,
    'secure': False,
    'token': '01cbad9aab25e243e0a6e98f5a848d32c3092fa909fef666',
    'url': 'http://localhost:8888/'
}
```
Connect using `IP:port` where `IP` is the IP address of the docker container on which the process is
running.

To retrieve the connection information and achieve a graceful shutdown of the server and its running
kernels, we run an extra Flask API inside the container. This API starts the Jupyter server in a
subprocess and returns its `server_info` to the process outside of the `jupyter-server` container.
Additionally, the API gracefully shuts down the Jupyter sending by sending a POST request to
Jupyter server process at `http:localhost:8888/api/shutdown`. An alternative way to gracefully shut
down the subprocess is with a `SIGTERM`, see the example below.
```python
import os
import signal

proc = Popen(args=['jupyter', 'lab'])

# Shuts down the Jupyter server together with associated running kernels.
os.kill(proc.pid, signal.SIGTERM)
```

When starting the Jupyter server process the following (hard-coded) settings are used
* `--ip=0.0.0.0`: Allow other containers to access the Jupyter server.
* `--port=8888`: The port at which the Jupyter server can be reached inside the container (note that
    this port is published using docker).
* `--notebook-dir=/notebooks`: The path were the directory with files is mounted.

Additionally, `--gateway-url` is given via the API as it depends on the IP address of the running docker
container that runs the gateway.


## TODO
- [ ] Since this will be running inside a docker container we need a good stacktrace.
- [ ] Currently, the `connection_file` is stored at a hardcoded location. Put this location in a
    config.
- [ ] When it comes to the loading the `config.py` in the `main.py` it should use the `from_pyfile`
    instead. Additionally, it could load `from_envvar("SOME_VAR_TO_DISABLE_DEBUG")` which is only
    set in the Dockerfile. This way, when building the Dockerfile, DEBUG is always set to False and
    during development always to True. Have a look https://flask.palletsprojects.com/en/1.1.x/config/
- [X] How exactly does everything work with the `__init__.py` file. When is it called and where
    should it be placed? 
    Then what is this: https://github.com/timbrel/GitSavvy/issues/626
- [ ] Maybe it is possible to set an ENV variable to determine where the Jupyter `connection_file`
    is written instead of using their internal functions. The latter is more susceptible to erros in
    the future if their internal framework changes. Although for now this does not seem that
    important. I don't thinkt the Jupyter ecosystem will change this much that (ever possibly).
- [ ] I should put environment variables into the docker container. For example the notebook
    directory. Then I can set one for testing (without docker) and one for inside the container
    (which can be hardcoded to "/notebooks", since the files are always mounted there)
- [ ] Logging
- [ ] Create `/app/errors/` with `__init__.py` and `handlers.py` to create the blueprints and handle
    the errors respectively. See this one https://flask-restplus.readthedocs.io/en/stable/errors.html
    for examples of handlers.
- [ ] Testing with Flask https://flask.palletsprojects.com/en/1.1.x/testing/ I think it is best to
    create the factory application. Then call the `create_app` and then do `app.test_client()`


## Temporary fixes
`flask-restplus` is broken by `Werkzeug 1.0.0`. Thus make sure to `pip install Werkzeug=0.16.1`.
This is currently an [open github issue](https://github.com/noirbizarre/flask-restplus/issues/777)
