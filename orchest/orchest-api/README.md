# orchest-api

Make sure the `install_orchest.py` is run before launching the API.


## /launches
During development (or before a good fix), some manual labor has to be conducted before a pipeline
can be launched. That is:
* `chmod -R 0777 /var/run/docker.sock`: let docker containers be spawned from inside other containers.
* `rm api/resources.db` (if one exists): issues with persistent pipeline uuids. 

The latter issue does not occur when running the orchest-api inside a container, since the db is
created on start.

When a pipeline is launched, the following will happen
1. The start of a `jupyter-enterprise-gateway` (EG) container.
2. The start of a `jupyter-server` (our own container) that will connect its Jupyter server process to the EG container.


### Implementation details
Jupyter-enterprise-gateway (EG) 
* Image: `elyra/enterprise-gateway:dev`
* Environment variable `EG_DOCKER_NETWORK` to make sure that kernels are launched on the same docker network
* Mounts
    * `/var/run/docker.sock` at `/var/run/docker.sock`: start docker containers from inside docker (remember to `chmod` the `docker.sock` file).
    * `etc/kernels` at `/usr/local/share/jupyter/kernels`: get custom kernelspecs.

Jupyter-server 
* Image: has to be build manually from the `jupyter-server/Dockerfile`
* Mounts
    * `pipeline_dir`, containing the path to the pipeline files, at `/notebooks`

Information on kernelspecs. Take the following example
```
{
  "language": "python",
  "display_name": "Python on Docker",
  "metadata": {
    "process_proxy": {
      "class_name": "enterprise_gateway.services.processproxies.docker_swarm.DockerProcessProxy",
      "config": {
        "image_name": "elyra/kernel-py:2.0.0"
      }
    }
  },
  "env": {
  },
  "argv": [
    "python",
    "/usr/local/share/jupyter/kernels/python_docker/scripts/launch_docker.py",
    "--RemoteProcessProxy.kernel-id",
    "{kernel_id}",
    "--RemoteProcessProxy.response-address",
    "{response_address}"
  ]
}
```
The key configurations are: `metadata.process_proxy.class_name` and
`metadata.process_proxy.config.image_name`. They define the process proxy class and image to be used
respectively.
* More on process proxy class can be found at the [jupyter enterprise gateway documentation](https://jupyter-enterprise-gateway.readthedocs.io/en/latest/system-architecture.html#process-proxy). In short it defines what class manages the kernel.
* The image describes the container that the EG will start when the "Python on Docker" (`display_name`) kernel is chosen to be launched.
