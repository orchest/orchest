## Implementation details
Connecting to a JupyterLab instance requires to know its networking information and secret token,
which can be found in the `server_info`, e.g.:
```json
{
    'base_url': '/',
    'hostname': 'localhost',
    'notebook_dir': '/pipeline-dir',
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
Additionally, the API gracefully shuts down the JupyterLab by sending a POST request to the
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
* `--notebook-dir=/pipeline-dir`: The path were the directory with files is mounted.

Additionally, `--gateway-url` is given via the API as it depends on the IP address of the running docker
container that runs the gateway.


## Temporary fixes
`flask-restplus` is broken by `Werkzeug 1.0.0`. Thus make sure to `pip install Werkzeug=0.16.1`.
This is currently an [open github issue](https://github.com/noirbizarre/flask-restplus/issues/777)
