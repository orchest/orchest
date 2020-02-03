# jupyter-server
Naming convention
* The container running the Jupyter server process (the JupyterLab instance) is called "jupyter-server".

Inside the docker container there are two potential running processes
* Flask API (at port 80). This API is always running.
* Jupyter server process (at port 8888). Only runs when started via a POST request to the Flask API.

Example POST request to the jupyter-server API
```
{
  "gateway-url": "http://0.0.0.0:8888",
}
```

Commands to build and run the docker container
```
docker build -t "jupyter-server" .
docker rm $(docker ps -a -q)  # Makes sure the name "mytest" can be used
docker run --name mytest -p 8888:8888 -p 80:80 -v /Users/yannick/Documents/projects/Orchest/notebooks:/notebooks jupyter-server:latest
```


## Implementation details
Connecting to a JupyterLab instance requires to know its token, which can be found in the `server_info`
```
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
and the networking information. That is `IP:port` where `IP` is the IP address of the docker container on which the process is running.

To achieve this, we run an extra Flask API inside the container that has the task to start the Jupyter server in a subprocess and
return its `server_info` to the process outside of the jupyter-server container. Additionally, the API is used to shutdown the
Jupyter server process such that it shuts down running kernels before it shuts down the Jupyter server itself. This is done by
sending a POST request to `http:localhost:8888/api/shutdown/`. An alternative way is to shut down the subprocess with a `SIGTERM`
```python
import os
import signal

proc = Popen(args=['jupyter', 'lab'])

# Shuts down the Jupyter server together with associated running kernels.
os.kill(proc.pid, signal.SIGTERM)
```

When starting the Jupyter server process the following settings are used
* `--ip=0.0.0.0`
* `--port=8888`
* `--notebook-dir=/notebooks` The directory with files is always mounted at this path inside the container.
* `--gateway-url` is given via the API as it depends on the IP address of the running docker container that runs the gateway.
And the Flask API is running on port 80.
