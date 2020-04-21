import asyncio
from typing import Dict, Iterable, List, Optional, TypedDict

import aiodocker

from app import celery
from app.connections import RUNNER_CLIENTS


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
        * Given a selectin of UUIDs, run all their precursors (i.e.
          parents in a directed graph). This can be done either inclusive
          or exclusive of the selection.

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


# Can be thought of as a Mixin class.
# Or maybe it is the design pattern: composition over inheritance.
class PipelineStepRunner:
    def __init__(self,
                 properties: PipelineStepProperties,
                 parents: Optional[List['PipelineStep']] = None) -> None:
        self.properties = properties
        self.parents = parents if parents is not None else []

    async def run_on_docker(self,
                            docker_env: aiodocker.Docker,
                            wait_on_completion: bool = True) -> None:
        """Runs the container image defined in the step's properties.

        Running is done asynchronously.

        Args:
            docker_env: Docker environment to run containers (async).
            wait_on_completion: if True await containers, else do not.
                Awaiting containers is helpful when running a dependency
                graph (like a pipeline), because one step can only
                executed once all its ancestors have completed.
        """
        config = {'Image': self.properties['image']['image_name']}

        # Starts the container asynchronously, however, it does not wait
        # for completion of the container (like the `docker run` CLI
        # command does). Therefore the option to await the container
        # completion is introduced.
        container = await docker_env.containers.run(config=config)

        if wait_on_completion:
            await container.wait()

    async def run_ancestors_on_docker(self, docker_env: aiodocker.Docker) -> None:
        """Runs all ancestor steps before running itself.

        Args:
            docker: Docker environment to run containers (asynchronously).
        """
        # Before running the step itself, it has to run all incoming
        # steps.
        tasks = [asyncio.create_task(parent.run_ancestors_on_docker(docker_env))
                 for parent in self.parents]
        await asyncio.gather(*tasks)

        # The sentinel node cannot be executed itself.
        if self.properties is not None:
            await self.run_on_docker(docker_env)

    async def run_on_kubernetes(self):
        pass

    async def run_ancestors_on_kubernetes(self):
        # Call the run_on_kubernetes internally.
        pass


class PipelineStep(PipelineStepRunner):
    """A step of a pipeline.

    It can also be thought of as a node of a graph.

    Args:
        properties: properties of the step used for execution and front
            end.
        parents: the parents/incoming steps of the current step.

    Attributes:
        properties: see "Args" section.
        parents: see "Args" section.
    """
    def __init__(self,
                 properties: PipelineStepProperties,
                 parents: Optional[List['PipelineStep']] = None) -> None:
        # self.properties = properties
        # self.parents = parents if parents is not None else []
        super().__init__(properties, parents)

        # Keeping a list of children allows us to traverse the pipeline
        # also in the other direction. This is helpful for certain
        # Pipeline methods.
        self._children: List['PipelineStep'] = []

    # # TODO: I don't really like the name of this method.
    # async def run_self(self,
    #                    docker: aiodocker.Docker,
    #                    wait_on_completion: bool = True) -> None:
    #     """Runs the container image defined in the step's properties.

    #     Running is done asynchronously.

    #     Args:
    #         docker: Docker environment to run containers (asynchronously).
    #         wait_on_completion: if True await containers, else do not.
    #             Awaiting containers is helpful when running a dependency
    #             graph (like a pipeline), because one step can only
    #             executed once all its ancestors have completed.
    #     """
    #     config = {'Image': self.properties['image']['image_name']}

    #     # Starts the container asynchronously, however, it does not wait
    #     # for completion of the container (like the `docker run` CLI
    #     # command does). Therefore the option to await the container
    #     # completion is introduced.
    #     container = await docker.containers.run(config=config)

    #     if wait_on_completion:
    #         await container.wait()

    # async def run(self, docker: aiodocker.Docker) -> None:
    #     """Runs all ancestor steps before running itself.

    #     Args:
    #         docker: Docker environment to run containers (asynchronously).
    #     """
    #     # Before running the step itself, it has to run all incoming
    #     # steps.
    #     tasks = [asyncio.create_task(parent.run(docker)) for parent in self.parents]
    #     await asyncio.gather(*tasks)

    #     # The sentinel node cannot be executed itself.
    #     if self.properties is not None:
    #         await self.run_self(docker)

    async def run(self, compute_backend='docker'):
        """
        compute_backend = ('docker', 'kubernetes')
        """
        run_func = getattr(self, f'run_ancestors_on_{compute_backend}')

        # TODO: Make the comment below work.
        # runner_client = RUNNER_CLIENTS[compute_backend]
        runner_client = aiodocker.Docker()
        await run_func(runner_client)
        await runner_client.close()

        # note that we do not close the env here, since it might be used
        # again in the future.

    def __eq__(self, other):
        # TODO: for now steps get a UUID and are always only identified
        #       with the UUID. Thus if they get additional parents and/or
        #       children, then they will stay the same. I think this is
        #       fine though.
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
        # TODO: keep_steps = set(self.steps) & set(selection)
        keep_steps = [step for step in self.steps
                      if step.properties['uuid'] in selection]

        # Only keep connection to parents and children if these steps are
        # also included in the selection.
        new_steps = []
        for step in keep_steps:
            # TODO: I guess these properties point to the same object now.
            #       This should be fine since the properties itself do not
            #       get changed. Although the incoming_connections property
            #       is no longer correct.
            # TODO: Deepclone it and update the incoming_connections
            new_step = PipelineStep(step.properties)
            new_step.parents = [s for s in step.parents if s in keep_steps]
            new_step._children = [s for s in step._children if s in keep_steps]
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

            # TODO: again the properties point to the old properties dict.
            #       Therefore containing incorrect "incoming_connections".
            #       Make a deepcopy.
            # Create a new Pipeline step that is a copy of the step.
            new_step = PipelineStep(step.properties, step.parents)

            # NOTE: the childrens list has to be updated, since the
            # sentinel node uses its information to be computed. On the
            # other hand, the parents, do not change and are always all
            # included.
            new_step._children = [s for s in step._children if s in steps]
            steps.add(new_step)
            stack.extend(new_step.parents)

        if not inclusive:
            steps = [step for step in steps if step.properties['uuid'] not in selection]

        return Pipeline(steps=list(steps))

    async def run(self):
        """Runs the Pipeline asynchronously."""
        await self.sentinel.run(compute_backend='docker')

    def __repr__(self):
        return f'Pipeline({self.steps!r})'


# -- New idea --
# Using the class structure below we can run Pipelines on different
# back-ends.

# NOTE: we introduce the terminology that a node can be an ancestor of
#       itself. A parent would be a proper ancestor.
# class PipelineStepRunner:
#     async def run_on_docker(self):
#         pass

#     async def run_ancestors_on_docker(self):
#         # Call the run_on_docker internally.
#         pass

#     async def run_on_kubernetes(self):
#         pass

#     async def run_ancestors_on_kubernetes(self):
#         # Call the run_on_kubernetes internally.
#         pass


# class PipelineStep(PipelineStepRunner):
#     async def run(self, compute_backend='docker'):
#         """
#         compute_backend = ('docker', 'kubernetes')
#         """
#         run_func = getattr(self, f'run_ancestors_on_{compute_backend}')

#         # from connections import RUNNER_CONNECTIONS
#         runner_env = RUNNER_CONNECTIONS[compute_backend]['env']
#         await run_func(runner_env)

#         # note that we do not close the env here, since it might be used
#         # again in the future.
