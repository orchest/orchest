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


## Partial runs

`orchest/orchest/orchest-api$ celery worker -A app.celery -l INFO`

We probably do not want to send the pipeline.json over the API, since the pipeline might be outdated
if the Task queue is full and the task has to wait for a long time. (It is no longer the same as the
UI.) Maybe just do some priority queue in celery. Just let background tasks (experiments) get a
lower priority such that the partial runs can always be executed.

## TODO
- [ ] Some flaws when it comes to the `Pipeline` class:
    - [X] The induced subgraph has to be proper and not contain children that are not part of the
        selection. Because then the sentinel node does not get computed correctly (since it looks
        for the nodes that do not have children).
    - [ ] It would be faster to immediately construct the subgraph etc. directly from the json
        description. Although this is a lot more messy
    - [X] When Pipeline --inplace--> subgraph, then the sentinel node has to be set to `None`
- [X] Do we want to check for cycles?
- [ ] Run the docker containers of the `aiodocker` on the Orchest docker network.
- [X] Note that the pipeline is run on docker. Maybe we can add an abstraction layer such that it
    can easily be swapped to run on k8s.
    * Idea: Let `Pipeline` class function as a Mixin to `PipelineRunnerDocker(Pipeline)` class that
        implements the `async def run():` instead of having it in the `Pipeline` class itself.
        Similarly for the `PipelineStep`.
- [ ] Running a pipeline is a Task. Thus we need some way to let the front-end know about completion
    of the pipeline and step (flask socketio?). Otherwise we could maybe write to the Celery broker?
    Some compute back-end?
- [X] Tests that check whether the pipeline execution order is correct.
- [ ] Write more tests since the pipeline execution order really is at the core of our product.
- [ ] Choosing the right broker for Celery
- [X] Add typing and documentation to the Pipeline and PipelineStep classes.
    - [X] Do we want to introduce a generic type for UUID? I think that makes sense. Nope... that
        would lose a lot of flexibility and speed we have as early early startup.
- [ ] Coverage report for testing that can be included on the GitHub page with a nice button.
- [ ] Error handling. If a step fails, should the entire pipeline fail? Or only sequential steps?
    Also handle error for Celery, nbconvert, etc.
- [ ] Logging
- [ ] Execution of containers and correct mount
- [X] API endpoint design for the runs
- [ ] How many runs per pipeline? Maybe multiple, but sequantially run just like a Jupyter cell runs
    after previous selected ones have finished (keep in mind that the runs operate on the same
    filesystem)
- [ ] Do we also want the jupyter-server and EG to also start via a Celery Task? Also check out
    docker-compose to get jupyter-server to reliably start after the EG (and connect to it)
    * How does JupyterHub start and connect to a Jupyter server? Maybe we can do something similar
        for our jupyter-server (and no longer need the Flask API to run inside the container).
- [ ] Put the `Pipeline` and `PipelineStep` classes some place else? Rick probably also uses them
    for his sdk. Some orchest-utils package?
