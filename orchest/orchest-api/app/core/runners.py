import asyncio
import copy
from typing import Dict, Iterable, List, Optional, TypedDict

import aiodocker

from app import celery


# TODO: this class is not extensive yet. The Other Dicts can be typed
#       with a TypedDict also.
class PipelineStepProperties(TypedDict):
    name: str
    uuid: str
    incoming_connections: List[str]  # list of UUIDs
    file_path: str
    image: Dict[str, str]
    experiment_json: str
    meta_data: Dict[str, List[int]]


class PipelineDescription(TypedDict):
    name: str
    uuid: str
    steps: Dict[str, PipelineStepProperties]


@celery.task
def run_partial(uuids: Iterable[str],
                run_type: str,
                pipeline_description: PipelineDescription) -> None:
    """Runs a pipeline partially.

    A partial run is described by the pipeline description, selection of
    step UUIDs and a run type. The call-order of the steps is always
    preserved, e.g. a --> b then a will always be run before b.

    Type of runs:
        * Run all the steps of the pipeline.
        * Given a selection of UUIDs run only the selection.
        * Given a selectin of UUIDs, run all their proper ancestors (i.e.
          parents in a directed graph). This can be done either inclusive
          or exclusive of the selection (making it run all ancestors
          instead of proper ancestors - thus including the step itself).

    NOTE:
        Running a pipeline fully can also be described as a partial run.

    Args:
        uuids: a selection/sequence of pipeline step UUIDs. If `run_type`
            equals "full", then this argument is ignored.
        run_type: one of ("full", "selection", "incoming").
        pipeline_description: a json description of the pipeline.
    """

    # Get the pipeline to run according to the run_type.
    pipeline = construct_pipeline(uuids, run_type, pipeline_description)

    # Run the subgraph in parallel.
    asyncio.run(pipeline.run())


def construct_pipeline(uuids: Iterable[str],
                       run_type: str,
                       pipeline_description: PipelineDescription,
                       config: Optional[Dict] = None) -> 'Pipeline':
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
        uuids: a selection/sequence of pipeline step UUIDs. If `run_type`
            equals "full", then this argument is ignored.
        run_type: one of ("full", "selection", "incoming").
        pipeline_description: a json description of the pipeline.
        config: configuration for the `run_type`.

    Returns:
        Always returns a Pipeline. Depending on the `run_type` the
        Pipeline is constructed as follows from the given
        `pipeline_description`:
            * "full" -> entire pipeline from description
            * "selection" -> induced subgraph based on selection.
            * "incoming" -> all incoming steps of the selection. In other
                words: all ancestors of the steps of the selection.

        As of now, the selection itself is NOT included in the Pipeline
        if `run_type` equals "incoming".
    """
    # Create a pipeline from the pipeline_description. And run the
    # appropriate method based on the run_type.
    pipeline = Pipeline.from_json(pipeline_description)

    if run_type == 'full':
        return pipeline

    if run_type == 'selection':
        return pipeline.get_induced_subgraph(uuids)

    if run_type == 'incoming':
        return pipeline.incoming(uuids, inclusive=False)


class PipelineStepRunner:
    """Runs a PipelineStep on a chosen backend.

    It follows the composition over inheritance design pattern, since a
    `PipelineStep` "has-a" `PipelineStepRunner` instead of "is-a".

    Args:
        properties: properties of the step used for execution.
        parents: the parents/incoming steps of the current step.

    Attributes:
        properties: see "Args" section.
        parents: see "Args" section.
        """
    def __init__(self,
                 properties: PipelineStepProperties,
                 parents: Optional[List['PipelineStep']] = None) -> None:
        self.properties = properties
        self.parents = parents if parents is not None else []

        # A step only has to be started once when executing a Pipeline.
        self._started: bool = False

    async def run_on_docker(self,
                            docker_client: aiodocker.Docker,
                            wait_on_completion: bool = True) -> None:
        """Runs the container image defined in the step's properties.

        Running is done asynchronously.

        Args:
            docker_client: Docker environment to run containers (async).
            wait_on_completion: if True await containers, else do not.
                Awaiting containers is helpful when running a dependency
                graph (like a pipeline), because one step can only
                executed once all its proper ancestors have completed.
        """
        # Don't start a step if it has already been started.
        if self._started:
            return

        # Indicate that the step has started executing.
        self._started = True

        # NOTE: Passing the UUID as a configuration parameter does not
        # get used by the docker_client. However, we use it for testing
        # to check whether the resolve order of the pipeline is correct.
        config = {
            'Image': self.properties['image']['image_name'],
            'uuid': self.properties['uuid']
        }

        # Starts the container asynchronously, however, it does not wait
        # for completion of the container (like the `docker run` CLI
        # command does). Therefore the option to await the container
        # completion is introduced.
        container = await docker_client.containers.run(config=config)

        if wait_on_completion:
            await container.wait()

    async def run_ancestors_on_docker(self, docker_client: aiodocker.Docker) -> None:
        """Runs all ancestor steps before running itself.

        We make a difference between an ancestor and proper ancestor. A
        step is an ancestor of itself but not a proper ancestor.

        Args:
            docker_client: Docker environment to run containers (async).
        """
        # Before running the step itself, it has to run all incoming
        # steps.
        tasks = [asyncio.create_task(parent.run_ancestors_on_docker(docker_client))
                 for parent in self.parents]
        await asyncio.gather(*tasks)

        # The sentinel node cannot be executed itself.
        if self.properties is not None:
            await self.run_on_docker(docker_client)

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
    def __init__(self,
                 properties: PipelineStepProperties,
                 parents: Optional[List['PipelineStep']] = None) -> None:
        super().__init__(properties, parents)

        # Keeping a list of children allows us to traverse the pipeline
        # also in the other direction. This is helpful for certain
        # Pipeline methods.
        self._children: List['PipelineStep'] = []

    async def run(self,
                  runner_client: aiodocker.Docker,
                  compute_backend: str = 'docker') -> None:
        """Runs the `PipelineStep` on the given compute backend.

        Args:
            runner_client: client to manage the compute backend.
            compute_backend: one of ("docker", "kubernetes").
        """
        run_func = getattr(self, f'run_ancestors_on_{compute_backend}')
        await run_func(runner_client)

    def __eq__(self, other):
        # NOTE: steps get a UUID and are always only identified with the
        # UUID. Thus if they get additional parents and/or children, then
        # they will stay the same. I think this is fine though.
        return self.properties['uuid'] == other.properties['uuid']

    def __hash__(self):
        return hash(self.properties['uuid'])

    def __str__(self):
        if self.properties is not None:
            return f'<PipelineStep: {self.properties["name"]}>'

        return f'<Pipelinestep: None>'

    def __repr__(self):
        # TODO: This is actually not correct: it should be self.properties.
        #       But this just look ugly as hell (so maybe for later). And
        #       strictly, should also include its parents.
        if self.properties is not None:
            return f'PipelineStep({self.properties["name"]!r})'

        return f'Pipelinestep(None)'


class Pipeline:
    def __init__(self, steps: List[PipelineStep]) -> None:
        self.steps = steps

        # See the sentinel property for explanation.
        self._sentinel: Optional[PipelineStep] = None

    @classmethod
    def from_json(cls, description: PipelineDescription) -> 'Pipeline':
        """Constructs a pipeline from a json description.

        This is an alternative constructur.

        Args:
            description: json description of Pipeline.

        Returns:
            A pipeline object defined by the given description.
        """
        # Create a mapping for all the steps from UUID to object.
        steps = {uuid: PipelineStep(properties)
                 for uuid, properties in description['steps'].items()}

        # For every step populate its parents and _children attributes.
        for step in steps.values():
            for uuid in step.properties['incoming_connections']:
                step.parents.append(steps[uuid])
                steps[uuid]._children.append(step)

        return cls(list(steps.values()))

    @property
    def sentinel(self):
        """Returns the sentinel step, connected to the leaf steps.

        Similarly to the implementation of a DLL, we add a sentinel node
        to the end of the pipeline (i.e. all steps that do not have
        children will be connected to the sentinel node). By having a
        pointer to the sentinel we can traverse the entire pipeline.
        This way we can start a run by "running" the sentinel node.
        """
        if self._sentinel is None:
            self._sentinel = PipelineStep(None)
            self._sentinel.parents = [step for step in self.steps if not step._children]

        return self._sentinel

    def get_induced_subgraph(self, selection: Iterable[str]) -> 'Pipeline':
        """Returns a new pipeline whos set of steps equal the selection.

        Takes an induced subgraph of the pipeline formed by a subset of
        its steps given by the selection (of UUIDs).

        Example:
            When the selection consists of: a --> b. Then it is important
            that "a" is run before "b". Therefore the induced subgraph
            has to be taken to ensure the correct ordering, instead of
            executing the steps independently (and in parallel).

        Args:
            selection: list of UUIDs representing `PipelineStep`s.

        Returns:
            An induced pipeline by the set of steps (defined by the given
            selection).
        """
        keep_steps = [step for step in self.steps
                      if step.properties['uuid'] in selection]

        # Only keep connection to parents and children if these steps are
        # also included in the selection. In addition, to keep consistency
        # of the properties attributes of the steps, we update the
        # "incoming_connections" to be representative of the new pipeline
        # structure.
        new_steps = []
        for step in keep_steps:
            # Take a deepcopy such that the properties of the new and
            # original step do not point to the same object (since we
            # want to update the "incoming_connections").
            new_step = PipelineStep(copy.deepcopy(step.properties))
            new_step.parents = [s for s in step.parents if s in keep_steps]
            new_step._children = [s for s in step._children if s in keep_steps]
            new_step.properties['incoming_connections'] = [s.properties['uuid']
                                                           for s in new_step.parents]
            new_steps.append(new_step)

        return Pipeline(steps=new_steps)

    def convert_to_induced_subgraph(self, selection: List[str]) -> None:
        """Converts the pipeline to a subpipeline.

        NOTE:
            Exactly the same as `get_induced_subgraph` except that it
            modifies the underlying `Pipeline` object inplace.
        """
        self.steps = [step for step in self.steps
                      if step.properties['uuid'] in selection]

        # Removing connection from steps to "non-existing" steps, i.e.
        # steps that are not included in the selection.
        for step in self.steps:
            step.parents = [s for s in step.parents if s in self.steps]
            step._children = [s for s in step._children if s in self.steps]

        # Reset the sentinel.
        self._sentinel = None

    def incoming(self,
                 selection: Iterable[str],
                 inclusive: bool = False) -> 'Pipeline':
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
            An induced pipeline by the set of steps (defined by the given
            selection).
        """
        # This set will be populated with all the steps that are ancestors
        # of the sets given by the selection. Depending on the kwarg
        # `inclusive` the steps from the selection itself will either be
        # included or excluded.
        steps = set()

        # Essentially a BFS where its stack gets initialized with multiple
        # root nodes.
        stack = [step for step in self.steps if step.properties['uuid'] in selection]

        while stack:
            step = stack.pop()
            if step in steps:
                continue

            # Create a new Pipeline step that is a copy of the step. For
            # consistency also update the properties attribute and make
            # it point to a new object.
            new_properties = copy.deepcopy(step.properties)
            new_properties['incoming_connections'] = [s.properties['uuid']
                                                      for s in step.parents]
            new_step = PipelineStep(new_properties, step.parents)

            # NOTE: the childrens list has to be updated, since the
            # sentinel node uses its information to be computed. On the
            # other hand, the parents, do not change and are always all
            # included.
            new_step._children = [s for s in step._children if s in steps]
            steps.add(new_step)
            stack.extend(new_step.parents)

        if not inclusive:
            steps = set(step for step in steps
                        if step.properties['uuid'] not in selection)

        return Pipeline(steps=list(steps))

    async def run(self):
        """Runs the Pipeline asynchronously.

        TODO:
            The function should also take the argument `compute_backend`
            Although this can be done later, since we do not support
            any other compute backends yet.
        """
        # We have to instantiate the Docker() client here instead of in
        # the connections.py main module. Because the client has to be
        # bound to an asyncio eventloop.
        runner_client = aiodocker.Docker()
        await self.sentinel.run(runner_client, compute_backend='docker')
        await runner_client.close()

        # Reset the execution environment of the Pipeline.
        for step in self.steps:
            step._started = False

    def __repr__(self):
        return f'Pipeline({self.steps!r})'
