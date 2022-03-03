# orchest-api

Make sure the `install_orchest.py` is run before launching the API.

## /sessions

During development (or before a good fix), some manual labor has to be conducted before a pipeline
can be launched. That is:

- `rm api/resources.db` (if one exists): issues with persistent pipeline uuids.

The latter issue does not occur when running the orchest-api inside a container, since the db is
created on start.

When a pipeline is launched, the following will happen

1. The start of a `jupyter-enterprise-gateway` (EG) container.
2. The start of a `jupyter-server` (our own container) that will connect its Jupyter server process to the EG container.

### Implementation details

Jupyter-enterprise-gateway (EG)

- Image: `elyra/enterprise-gateway:dev`
- Mounts
  - `etc/kernels` at `/usr/local/share/jupyter/kernels`: get custom kernelspecs.

Jupyter-server

- Image: has to be build manually from the `jupyter-server/Dockerfile`
- Mounts
  - `project_dir`, containing the path to the pipeline files, at `/project-dir`

Information on kernelspecs. Take the following example

```
{
  "language": "python",
  "display_name": "Python on Docker",
  "metadata": {
    "process_proxy": {
      "class_name": "enterprise_gateway.services.processproxies.docker_swarm.DockerProcessProxy",
      "config": {
        "image_name": "elyra/kernel-py:2.2.0"
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

- More on process proxy class can be found at the [jupyter enterprise gateway documentation](https://jupyter-enterprise-gateway.readthedocs.io/en/latest/system-architecture.html#process-proxy). In short it defines what class manages the kernel.
- The image describes the container that the EG will start when the "Python on Docker" (`display_name`) kernel is chosen to be launched.

## Partial runs

Do not forget to start a Celery worker to run the background tasks for the Flask API:
`orchest/services/orchest-api$ celery worker -A app.core.tasks -l INFO`

The logic here is straightforward.

1. API gets called to start a (partial) run through a POST request to `/api/runs/`
2. Inside the POST a payload is given which contains a specification of the run and the pipeline.
3. The run is then started as a background task through Celery. In this case `run_pipeline` in the
   `/app/core/tasks.py` module.
4. The task converts the JSON description of the pipeline to a `Pipeline` object and then calls its
   `run(task_id)` function, where `task_id` is the id of the Celery task. (The id is used to update
   the status of the task inside the sqlite database.)
5. The pipeline execution order is resolved through asynchronous calls using `asyncio`.
6. Each step calls the API (multiple times) using a PUT to notify about its individual status (such
   that it can be displayed in the UI).
7. Once the pipeline is done executing it will update its own status (note that the status is always
   "SUCCESS" once it has finished, errors are reflected by the individual steps, not the pipline).
   Lastly, the "environment" is reset for the next run.

### Some thoughts

The application structure has become reasonably complex due to Celery integration. It might be best
to put all the Celery related things in a seperate package (away from the api). Because the
functions that Celery executes do not need the flask app context. Now Celery is completely entangled
through the API (due to cirular imports).
This works. See my jobs folder. (Created a package with setup.py that uses celery tasks and
also initiates the Celery instance, the celery worker -A is then started on this instance. Another
package can then import from this package, after installing it in the environment, and call the
functions with and without .delay() to send it to the task queue).

We probably do not want to send the pipeline.json over the API, since the pipeline might be outdated
if the Task queue is full and the task has to wait for a long time. (It is no longer the same as the
UI.) Maybe just do some priority queue in celery. Just let background tasks (jobs) get a
lower priority such that the partial runs can always be executed.
