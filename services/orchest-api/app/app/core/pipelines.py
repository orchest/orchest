import asyncio
import copy
import logging
import os
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Set, TypedDict

import aiodocker
import aiohttp

from _orchest.internals import config as _config
from _orchest.internals.utils import get_device_requests, get_orchest_mounts
from config import CONFIG_CLASS


# TODO: this class is not extensive yet. The Other Dicts can be typed
#       with a TypedDict also.
class PipelineStepProperties(TypedDict):
    name: str
    uuid: str
    incoming_connections: List[str]  # list of UUIDs
    file_path: str
    environment: str
    parameters: dict
    meta_data: Dict[str, List[int]]


class PipelineDefinition(TypedDict):
    name: str
    uuid: str
    steps: Dict[str, PipelineStepProperties]
    parameters: Dict[str, Any]
    settings: Dict[str, Any]


def construct_pipeline(
    uuids: Iterable[str],
    run_type: str,
    pipeline_definition: PipelineDefinition,
    **kwargs,
) -> "Pipeline":
    """Constructs a pipeline from a description with selection criteria.

    Based on the run type and selection of UUIDs, constructs the
    appropriate Pipeline.

    TODO:
        Include config options to be based to methods. This can be done
        via the **kwargs option.

        Example: waiting on container completion, or inclusive or
            exclusive of the selection for "incoming" `run_type`.

        All options for the config should be documented somewhere.

    Args:
        uuids: a selection/sequence of pipeline step UUIDs. If
            `run_type` equals "full", then this argument is ignored.
        run_type: one of ("full", "selection", "incoming").
        pipeline_definition: a json description of the pipeline.
        config: configuration for the `run_type`.

    Returns:
        Always returns a Pipeline. Depending on the `run_type` the
        Pipeline is constructed as follows from the given
        `pipeline_definition`:
            * "full" -> entire pipeline from description
            * "selection" -> induced subgraph based on selection.
            * "incoming" -> all incoming steps of the selection. In
                other words: all ancestors of the steps of the
                selection.

        As of now, the selection itself is NOT included in the Pipeline
        if `run_type` equals "incoming".

    Raises:
        ValueError if the `run_type` is incorrectly specified.
    """
    # Create a pipeline from the pipeline_definition. And run the
    # appropriate method based on the run_type.
    pipeline = Pipeline.from_json(pipeline_definition)

    if run_type == "full":
        return pipeline

    if run_type == "selection":
        return pipeline.get_induced_subgraph(uuids)

    if run_type == "incoming":
        return pipeline.incoming(uuids, inclusive=False)

    raise ValueError("Function not defined for specified run_type")


async def update_status(
    status: str,
    task_id: str,
    session: aiohttp.ClientSession,
    type: str,
    run_endpoint: str,
    uuid: Optional[str] = None,
) -> Any:
    """Updates status of `type` via the orchest-api.

    Args:
        type: One of ``['pipeline', 'step']``.
    """
    data = {"status": status}
    if data["status"] == "STARTED":
        data["started_time"] = datetime.utcnow().isoformat()
    elif data["status"] in ["SUCCESS", "FAILURE"]:
        data["finished_time"] = datetime.utcnow().isoformat()

    base_url = f"{CONFIG_CLASS.ORCHEST_API_ADDRESS}/{run_endpoint}/{task_id}"

    if type == "step":
        url = f"{base_url}/{uuid}"

    elif type == "pipeline":
        url = base_url

    # Just await the response. The proposed fix on the aiohttp GitHub to
    # do `response.json(content_type=None)` still results in parsing
    # issues.
    await session.put(url, json=data)


def get_volume_mounts(run_config, task_id):

    # Determine the appropriate name for the volume that shares
    # temporary data amongst containers.

    # This branching logic is because the volume is shared with Jupyter
    # kernels.
    # For the InteractiveRuns, while for NonInteractiveRuns it's unique
    # to the task.
    if run_config["run_endpoint"] == "runs":
        volume_uuid = run_config["pipeline_uuid"]
    elif run_config["run_endpoint"].startswith("jobs"):
        volume_uuid = task_id
    temp_volume_name = _config.TEMP_VOLUME_NAME.format(
        uuid=volume_uuid, project_uuid=run_config["project_uuid"]
    )

    return [f"{temp_volume_name}:{_config.TEMP_DIRECTORY_PATH}"]


class PipelineStepRunner:
    """Runs a PipelineStep on a chosen backend.

    This class can be thought of as a mixin class to the `PipelineStep`
    class.

    Args:
        properties: properties of the step used for execution.
        parents: the parents/incoming steps of the current step.

    Attributes:
        properties: see "Args" section.
        parents: see "Args" section.
    """

    def __init__(
        self,
        properties: PipelineStepProperties,
        parents: Optional[List["PipelineStep"]] = None,
    ) -> None:
        self.properties = properties
        self.parents = parents if parents is not None else []

        # Keeping a list of children allows us to traverse the pipeline
        # also in the other direction. This is helpful for certain
        # Pipeline methods.
        self._children: List["PipelineStep"] = []

        # Initial status is "PENDING".
        self._status: str = "PENDING"

    # TODO: specify a config argument here that is updated as the config
    #       variable that is passed to run the docker container.

    async def run_on_docker(
        self,
        docker_client: aiodocker.Docker,
        session: aiohttp.ClientSession,
        task_id: str,
        *,
        run_config: Dict[str, Any],
    ) -> Optional[str]:
        """Runs the container image defined in the step's properties.

        Running is done asynchronously.

        Args:
            docker_client: Docker environment to run containers (async).
            wait_on_completion: if True await containers, else do not.
                Awaiting containers is helpful when running a dependency
                graph (like a pipeline), because one step can only
                executed once all its proper ancestors have completed.
        """
        if not all([parent._status == "SUCCESS" for parent in self.parents]):
            # The step cannot be run yet.
            return self._status

        if self._status != "PENDING":
            # The step has already been started.

            # Each parent attempts to start their children when they
            # finish. When all parents finish simultaneously (with all
            # their _status'es being "SUCCESS") not checking whether
            # the child has started or not would lead to multiple start
            # attempts of the child, resulting in errors.
            return self._status

        # TODO: better error handling?
        self._status = "STARTED"
        await update_status(
            self._status,
            task_id,
            session,
            type="step",
            run_endpoint=run_config["run_endpoint"],
            uuid=self.properties["uuid"],
        )

        orchest_mounts = get_orchest_mounts(
            project_dir=_config.PROJECT_DIR,
            pipeline_file=_config.PIPELINE_FILE,
            host_user_dir=run_config["host_user_dir"],
            host_project_dir=run_config["project_dir"],
            host_pipeline_file=os.path.join(
                run_config["project_dir"], run_config["pipeline_path"]
            ),
            mount_form="docker-engine",
        )

        # add volume mount
        orchest_mounts += get_volume_mounts(run_config, task_id)

        device_requests = get_device_requests(
            self.properties["environment"],
            run_config["project_uuid"],
            form="docker-engine",
        )

        # The working directory is the location of the file being
        # executed.
        project_relative_file_path = os.path.join(
            os.path.split(run_config["pipeline_path"])[0], self.properties["file_path"]
        )

        working_dir = os.path.split(project_relative_file_path)[0]

        user_env_variables = [
            f"{key}={value}" for key, value in run_config["user_env_variables"].items()
        ]

        config = {
            "Image": run_config["env_uuid_docker_id_mappings"][
                self.properties["environment"]
            ],
            # Note that the order of concatenation matters, so that
            # there is no risk that the user overwrites internal
            # variables accidentally.
            "Env": user_env_variables
            + [
                f'ORCHEST_STEP_UUID={self.properties["uuid"]}',
                f'ORCHEST_SESSION_UUID={run_config["session_uuid"]}',
                f'ORCHEST_SESSION_TYPE={run_config["session_type"]}',
                f'ORCHEST_PIPELINE_UUID={run_config["pipeline_uuid"]}',
                f"ORCHEST_PIPELINE_PATH={_config.PIPELINE_FILE}",
                f'ORCHEST_PROJECT_UUID={run_config["project_uuid"]}',
                # ORCHEST_MEMORY_EVICTION is never present when running
                # notebooks interactively and otherwise always present,
                # this means eviction of objects from memory can never
                # be triggered when running notebooks interactively.
                # This environment variable being present implies that
                # the Orchest SDK will always emit an eviction message
                # given the choice, this however, does not imply that
                # eviction will actually take place, since the memory
                # server manager will check the pipeline definition
                # settings to decide whetever object eviction should
                # take place or not.
                "ORCHEST_MEMORY_EVICTION=1",
            ],
            "HostConfig": {
                "Binds": orchest_mounts,
                "DeviceRequests": device_requests,
                "GroupAdd": [os.environ.get("ORCHEST_HOST_GID")],
            },
            "Cmd": [
                "/orchest/bootscript.sh",
                "runnable",
                working_dir,
                project_relative_file_path,
            ],
            "NetworkingConfig": {"EndpointsConfig": {_config.DOCKER_NETWORK: {}}},
            # NOTE: the `'tests-uuid'` key is only used for tests and
            # gets ignored by the `docker_client`.
            "tests-uuid": self.properties["uuid"],
        }

        # Starts the container asynchronously, however, it does not wait
        # for completion of the container (like the `docker run` CLI
        # command does). Therefore the option to await the container
        # completion is introduced.
        try:
            container = await docker_client.containers.run(
                config=config,
                name=_config.PIPELINE_STEP_CONTAINER_NAME.format(
                    run_uuid=task_id, step_uuid=self.properties["uuid"]
                ),
            )

            data = await container.wait()

            # The status code will be 0 for "SUCCESS" and -N otherwise.
            # A negative value -N indicates that the child was
            # terminated by signal N (POSIX only).
            if data.get("StatusCode") != 0:
                self._status = "FAILURE"
                logging.error(
                    "Docker container for step %s failed with output:\n%s"
                    % (
                        self.properties["uuid"],
                        "".join(await container.log(stdout=True, stderr=True)),
                    )
                )
            else:
                self._status = "SUCCESS"

        except Exception as e:
            logging.error("Failed to run Docker container: %s" % e)
            self._status = "FAILURE"

        finally:
            await update_status(
                self._status,
                task_id,
                session,
                type="step",
                run_endpoint=run_config["run_endpoint"],
                uuid=self.properties["uuid"],
            )

        return self._status

    async def run_children_on_docker(
        self,
        docker_client: aiodocker.Docker,
        session: aiohttp.ClientSession,
        task_id: str,
        *,
        run_config: Dict[str, Any],
    ) -> Optional[str]:
        """Runs all children steps after running itself.

        A child run is only started if the step itself has successfully
        completed.

        Args:
            docker_client: Docker environment to run containers (async).
        """
        # NOTE: construction for sentinel since it cannot run itself (it
        # is empty).
        if self.properties:
            status = await self.run_on_docker(
                docker_client, session, task_id, run_config=run_config
            )
        else:
            status = "SUCCESS"

        if status == "SUCCESS":
            # If the task ran successfully then also try to run its
            # children.
            tasks = []
            for child in self._children:
                task = child.run_children_on_docker(
                    docker_client, session, task_id, run_config=run_config
                )
                tasks.append(asyncio.create_task(task))

            res = await asyncio.gather(*tasks)

            # If one of the children turns out to fail, then we say the
            # step itself has failed. Because we start by calling the
            # sentinel node which is placed at the start of
            # thepipeline.
            if "FAILURE" in res:
                return "FAILURE"

        elif status in ["FAILURE", "ABORTED"]:

            # The task did not run successfully, thus all its children
            # will be aborted.
            all_children = set()
            traversel = self._children.copy()
            while traversel:
                child = traversel.pop()
                if child not in all_children:
                    all_children.add(child)
                    traversel.extend(child._children)

            for child in all_children:
                child._status = "ABORTED"
                await update_status(
                    "ABORTED",
                    task_id,
                    session,
                    type="step",
                    run_endpoint=run_config["run_endpoint"],
                    uuid=child.properties["uuid"],
                )

            return "FAILURE"
        else:
            # The status could be STARTED, which means a parent tried to
            # invoke run_on_docker for a child that was already running.
            # We don't have to do anything in that case.
            pass

        return "SUCCESS"

    async def run_on_kubernetes(self):
        pass

    async def run_ancestors_on_kubernetes(self):
        # Call the run_on_kubernetes internally.
        pass


class PipelineStep(PipelineStepRunner):
    """A step of a pipeline.

    It can also be thought of as a node of a graph.

    Args:
        properties: properties of the step used for execution.
        parents: the parents/incoming steps of the current step.

    Attributes:
        properties: see "Args" section.
        parents: see "Args" section.
    """

    def __init__(
        self,
        properties: PipelineStepProperties,
        parents: Optional[List["PipelineStep"]] = None,
    ) -> None:
        super().__init__(properties, parents)

    async def run(
        self,
        runner_client: aiodocker.Docker,
        session: aiohttp.ClientSession,
        task_id: str,
        *,
        run_config: Dict[str, Any],
        compute_backend: str = "docker",
    ) -> None:
        """Runs the `PipelineStep` on the given compute backend.

        Args:
            runner_client: client to manage the compute backend.
            compute_backend: one of ("docker", "kubernetes").
        """
        # run_func =
        # getattr(self, f'run_ancestors_on_{compute_backend}')
        run_func = getattr(self, f"run_children_on_{compute_backend}")
        return await run_func(runner_client, session, task_id, run_config=run_config)

    def __eq__(self, other) -> bool:
        # NOTE: steps get a UUID and are always only identified with
        # the UUID. Thus if they get additional parents and/or children,
        # then they will stay the same. I think this is fine though.
        return self.properties["uuid"] == other.properties["uuid"]

    def __hash__(self) -> int:
        return hash(self.properties["uuid"])

    def __str__(self) -> str:
        if self.properties:
            return f'<PipelineStep: {self.properties["name"]}>'

        return "<Pipelinestep: None>"

    def __repr__(self) -> str:
        # TODO: This is actually not correct: it should be
        #       self.properties. But this just look ugly as hell
        #       (so maybe for later). And strictly, should also include
        #       its parents.
        if self.properties:
            return f'PipelineStep({self.properties["name"]!r})'

        return "Pipelinestep(None)"


class Pipeline:
    def __init__(self, steps: List[PipelineStep], properties: Dict[str, str]) -> None:
        self.steps = steps

        # TODO: we want to be able to serialize a Pipeline back to a
        #       json file. Therefore we would need to store the Pipeline
        #       name and UUID from the json first.
        # self.properties: Dict[str, str] = {}
        self.properties = properties

        # See the sentinel property for explanation.
        self._sentinel: Optional[PipelineStep] = None

    @classmethod
    def from_json(cls, description: PipelineDefinition) -> "Pipeline":
        """Constructs a pipeline from a json description.

        This is an alternative constructur.

        Args:
            description: json description of Pipeline.

        Returns:
            A pipeline object defined by the given description.
        """
        # Create a mapping for all the steps from UUID to object.
        steps = {
            uuid: PipelineStep(properties)
            for uuid, properties in description["steps"].items()
        }

        # For every step populate its parents and _children attributes.
        for step in steps.values():
            for uuid in step.properties["incoming_connections"]:
                step.parents.append(steps[uuid])
                steps[uuid]._children.append(step)

        properties = {
            "name": description["name"],
            "uuid": description["uuid"],
            "settings": description["settings"],
            "parameters": description.get("parameters", {}),
            "services": description.get("services", {}),
        }
        return cls(list(steps.values()), properties)

    def to_dict(self) -> PipelineDefinition:
        """Convert the Pipeline to its dictionary description."""
        description: PipelineDefinition = {"steps": {}}
        for step in self.steps:
            description["steps"][step.properties["uuid"]] = step.properties

        description.update(self.properties)
        return description

    def get_environments(self) -> Set[str]:
        """Returns the set of UUIDs of the used environments.

        Returns:
            Set of environments uuids used among the pipeline steps and
            services making use of orchest environments.

        """
        st_envs = set([step.properties["environment"] for step in self.steps])
        prefix = _config.ENVIRONMENT_AS_SERVICE_PREFIX
        sr_envs = set(
            [
                sr["image"].replace(prefix, "")
                for sr in self.properties.get("services", {}).values()
                if sr["image"].startswith(prefix)
            ]
        )

        return set.union(st_envs, sr_envs)

    def get_params(self) -> Dict[str, Any]:
        return self.properties.get("parameters", {})

    @property
    def sentinel(self) -> PipelineStep:
        """Returns the sentinel step, connected to the leaf steps.

        Similarly to the implementation of a DLL, we add a sentinel node
        to the end of the pipeline (i.e. all steps that do not have
        children will be connected to the sentinel node). By having a
        pointer to the sentinel we can traverse the entire pipeline.
        This way we can start a run by "running" the sentinel node.
        """
        if self._sentinel is None:
            self._sentinel = PipelineStep({})
            self._sentinel._children = [step for step in self.steps if not step.parents]

        return self._sentinel

    def get_induced_subgraph(self, selection: Iterable[str]) -> "Pipeline":
        """Returns a new pipeline whos set of steps equal the selection.

        Takes an induced subgraph of the pipeline formed by a subset of
        its steps given by the selection (of UUIDs).

        Example:
            When the selection consists of: a --> b. Then it is
            important that "a" is run before "b". Therefore the induced
            subgraph has to be taken to ensure the correct ordering,
            instead of executing the steps independently (and in
            parallel).

        Args:
            selection: list of UUIDs representing `PipelineStep`s.

        Returns:
            An induced pipeline by the set of steps (defined by the
            given selection).
        """
        keep_steps = [
            step for step in self.steps if step.properties["uuid"] in selection
        ]

        # Only keep connection to parents and children if these steps
        # are also included in the selection. In addition, to keep
        # consistency of the properties attributes of the steps, we
        # update the "incoming_connections" to be representative of the
        # new pipeline structure.
        new_steps = []
        for step in keep_steps:
            # Take a deepcopy such that the properties of the new and
            # original step do not point to the same object (since we
            # want to update the "incoming_connections").
            new_step = PipelineStep(copy.deepcopy(step.properties))
            new_step.parents = [s for s in step.parents if s in keep_steps]
            new_step._children = [s for s in step._children if s in keep_steps]
            new_step.properties["incoming_connections"] = [
                s.properties["uuid"] for s in new_step.parents
            ]
            new_steps.append(new_step)

        properties = copy.deepcopy(self.properties)
        return Pipeline(steps=new_steps, properties=properties)

    def convert_to_induced_subgraph(self, selection: List[str]) -> None:
        """Converts the pipeline to a subpipeline.

        NOTE:
            Exactly the same as `get_induced_subgraph` except that it
            modifies the underlying `Pipeline` object inplace.
        """
        self.steps = [
            step for step in self.steps if step.properties["uuid"] in selection
        ]

        # Removing connection from steps to "non-existing" steps, i.e.
        # steps that are not included in the selection.
        for step in self.steps:
            step.parents = [s for s in step.parents if s in self.steps]
            step._children = [s for s in step._children if s in self.steps]

        # Reset the sentinel.
        self._sentinel = None

    def incoming(self, selection: Iterable[str], inclusive: bool = False) -> "Pipeline":
        """Returns a new Pipeline of all ancestors of the selection.

        NOTE:
            The following can be thought of as an edge case. Lets say
            you have the pipeline: a --> b --> c and a selection of
            [b, c] with `inclusive` set to False. Then only step "a"
            would be run.

        Args:
            selection: list of UUIDs representing `PipelineStep`s.
            inclusive: if True, then the steps in the selection are also
                part of the returned `Pipeline`, else the steps will not
                be included.

        Returns:
            An induced pipeline by the set of steps (defined by the
            given selection).
        """
        # This set will be populated with all the steps that are
        # ancestors of the sets given by the selection. Depending on the
        # kwarg `inclusive` the steps from the selection itself will
        # either be included or excluded.
        steps = set()

        # Essentially a BFS where its stack gets initialized with
        # multiple root nodes.
        stack = [step for step in self.steps if step.properties["uuid"] in selection]

        while stack:
            step = stack.pop()
            if step in steps:
                continue

            # Create a new Pipeline step that is a copy of the step. For
            # consistency also update the properties attribute and make
            # it point to a new object.
            new_properties = copy.deepcopy(step.properties)
            new_properties["incoming_connections"] = [
                s.properties["uuid"] for s in step.parents
            ]
            new_step = PipelineStep(new_properties, step.parents)

            # NOTE: the childrens list has to be updated, since the
            # sentinel node uses its information to be computed. On the
            # other hand, the parents, do not change and are always all
            # included.
            new_step._children = [
                s
                for s in step._children
                if s in steps or s.properties["uuid"] in selection
            ]
            steps.add(new_step)
            stack.extend(new_step.parents)

        # Remove steps if the selection should not be included in the
        # new pipeline.
        if inclusive:
            steps_to_be_included = steps
        elif not inclusive:
            steps_to_be_included = steps - set(
                step for step in self.steps if step.properties["uuid"] in selection
            )

            # We have to go over the children again to make sure they
            # also do not include any steps of the selection.
            for step in steps_to_be_included:
                step._children = [
                    s for s in step._children if s in steps_to_be_included
                ]

        properties = copy.deepcopy(self.properties)
        return Pipeline(steps=list(steps_to_be_included), properties=properties)

    def kill_all_running_steps(self, task_id, compute_backend, run_config):
        run_func = getattr(self, f"kill_all_running_steps_on_{compute_backend}")
        return run_func(task_id, run_config)

    def kill_all_running_steps_on_docker(self, task_id, run_config):

        logging.info("Aborted: kill_all_running_steps")

        # list containers
        docker_client = run_config["docker_client"]
        containers = docker_client.containers.list()

        container_names_to_kill = set(
            [
                _config.PIPELINE_STEP_CONTAINER_NAME.format(
                    run_uuid=task_id, step_uuid=pipeline_step.properties["uuid"]
                )
                for pipeline_step in self.steps
            ]
        )

        for container in containers:
            if container.name in container_names_to_kill:
                try:
                    container.kill()
                except Exception as e:
                    logging.error(
                        "Failed to kill container %s. Error: %s (%s)"
                        % (container.get("name"), e, type(e))
                    )

    def remove_containerization_resources(self, task_id, compute_backend, run_config):
        run_func = getattr(
            self, f"remove_containerization_resources_on_{compute_backend}"
        )
        return run_func(task_id, run_config)

    def remove_containerization_resources_on_docker(self, task_id, run_config):

        logging.info("Cleaning up containerization resources on docker")

        # list containers
        docker_client = run_config["docker_client"]
        # use all=True to get stopped containers
        containers = docker_client.containers.list(all=True)

        container_names_to_remove = set(
            [
                _config.PIPELINE_STEP_CONTAINER_NAME.format(
                    run_uuid=task_id, step_uuid=pipeline_step.properties["uuid"]
                )
                for pipeline_step in self.steps
            ]
        )
        logging.info(container_names_to_remove)

        for container in containers:
            if container.name in container_names_to_remove:
                try:
                    logging.info("removing container %s" % container.name)
                    # force=False so we log if a container happened to
                    # be still running while we expected it to not be
                    # v=True does not actually do anything because,
                    # given the docker docs:
                    # https://docs.docker.com/engine/reference/commandline/rm/
                    # "This command removes the container and any
                    # volumes associated with it. Note that if a volume
                    # was specified with a name, it will not be removed.
                    # "
                    container.remove(force=False, v=True)
                except Exception as e:
                    logging.error(
                        "Failed to remove container %s. Error: %s (%s)"
                        % (container.get("name"), e, type(e))
                    )

    async def run(
        self, task_id: str, *, run_config: Dict[str, Any], compute_backend="docker"
    ) -> str:
        """Runs the Pipeline asynchronously.

        Args:
            run_config: Configuration of the run. Example
                {
                    'run_endpoint': 'runs',
                    'project_dir':
                        '/home/.../userdir/projects/<project_path>',
                    'pipeline_uuid': 'some-uuid',
                }

        Returns:
            Status

        TODO:
            The function should also take the argument `compute_backend`
            Although this can be done later, since we do not support
            any other compute backends yet.
        """
        # We have to instantiate the Docker() client here instead of in
        # the connections.py main module. Because the client has to be
        # bound to an asyncio eventloop.
        runner_client = aiodocker.Docker()

        async with aiohttp.ClientSession() as session:
            await update_status(
                "STARTED",
                task_id,
                session,
                type="pipeline",
                run_endpoint=run_config["run_endpoint"],
            )

            status = await self.sentinel.run(
                runner_client,
                session,
                task_id,
                run_config=run_config,
                compute_backend=compute_backend,
            )

            await update_status(
                status,
                task_id,
                session,
                type="pipeline",
                run_endpoint=run_config["run_endpoint"],
            )

        await runner_client.close()

        # Reset the execution environment of the Pipeline.
        for step in self.steps:
            step._status = "PENDING"

    def __repr__(self) -> str:
        return f"Pipeline({self.steps!r})"
