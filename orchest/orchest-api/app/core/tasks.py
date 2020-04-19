import asyncio
from typing import Any, Dict, Iterable, List, Optional

import aiodocker

from app import celery


@celery.task
def run_partial(uuids: Iterable[str], run_type: str, pipeline_description: Dict) -> None:
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
                       pipeline_description: Dict,
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

    Kwargs:
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


class PipelineStep:
    """PipelineStep.

    Some more.

    Args:
        properties: properties of the step. See example description
            in README.
        parents: oef

    Attributes:
        properties: see "Args" section.
        parents: see "Args" section.
    """
    def __init__(self,
                 properties: Dict[str, Any],
                 parents: Optional[List['PipelineStep']] = None) -> None:
        self.properties = properties
        self.parents = parents if parents is not None else []

        # Keeping a list of children allows us to traverse the pipeline
        # also in the other direction. This is helpful for certain
        # Pipeline methods.
        self._children = []

    async def run_self(self, docker, wait_on_completion=True):
        config = {'Image': self.properties['image']['image_name']}

        # Starts the container asynchronously, however, it does not wait
        # for completion of the container (like the `docker run` CLI
        # command does).
        container = await docker.containers.run(config=config)

        if wait_on_completion:
            await container.wait()

    async def run(self, docker):
        # Before running the step itself, it has to run all incoming
        # steps.
        tasks = [asyncio.create_task(parent.run(docker)) for parent in self.parents]
        await asyncio.gather(*tasks)

        # The sentinel node cannot be executed itself.
        if self.properties is not None:
            await self.run_self(docker)

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
        #       But this just look ugly as hell (so maybe for later)
        if self.properties is not None:
            return f'PipelineStep({self.properties["name"]!r})'

        return f'Pipelinestep(None)'


class Pipeline:
    def __init__(self, steps=None):
        self.steps = steps

        # Similarly to the implementation of a DLL, we add a sentinel node
        # to the end of the pipeline (i.e. all steps that do not have
        # children will be connected to the sentinel node). By having a
        # pointer to the sentinel we can traverse the entire pipeline.
        # This way we can start a run by "running" the sentinel node.
        self._sentinel: PipelineStep = None

    @classmethod
    def from_json(cls, description):
        """Constructs a pipeline from a json-like description.

        This is an alternative constructur the the __init__().

        Args:
            description (dict): json description of Pipeline.

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
        """

        TODO: description of sentinel
        """
        if self._sentinel is None:
            self._sentinel = PipelineStep(None)
            self._sentinel.parents = [step for step in self.steps if not step._children]

        return self._sentinel

    def convert_to_induced_subgraph(self, selection):
        """Converts the pipeline to a subpipeline.

        Takes an induced subgraph of the pipeline formed by a subset of
        its steps given by the selection (of UUIDs).

        NOTE:
            It is done like this because if a--> b is selected then the
            order should be kept in mind. We cannot simply run a and b
            as if they are independent.

        NOTE: Modifies inplace!
        """
        self.steps = [step for step in self.steps if step.properties['uuid'] in selection]

        # Removing connection from steps to "non-existing" steps, i.e.
        # steps that are not included in the selection.
        for step in self.steps:
            step.parents = [s for s in step.parents if s in self.steps]
            step._children = [s for s in step._children if s in self.steps]

    def get_induced_subgraph(self, selection):
        """Returns a new pipeline whos set of steps equal the selection.

        NOTE:
            Exactly the same as convert_to_subgraph except that it returns
            a new pipeline object instead of modifying it inplace.
        """
        # TODO: keep_steps = set(self.steps) & set(selection)
        keep_steps = [step for step in self.steps if step.properties['uuid'] in selection]

        # Only keep connection to parents and children if these steps are
        # also included in the selection.
        new_steps = []
        for step in keep_steps:
            # TODO: I guess these properties point to the same object now.
            #       This should be fine since the properties itself do not
            #       get changed. Although the incoming_connections property
            #       is no longer correct.
            new_step = PipelineStep(step.properties)
            new_step.parents = [s for s in step.parents if s in keep_steps]
            new_step._children = [s for s in step._children if s in keep_steps]
            new_steps.append(new_step)

        return Pipeline(steps=new_steps)

    def incoming(self, selection, inclusive=False):
        """
        TODO: take a--> b --> c where selection=[b, c]. Then b would
              also be in the steps to be executed. Do we want this?
        """

        # This set will be populated with all the steps that are ancestors
        # of the sets given by the selection. Depending on the kwarg
        # "inclusive" the steps from the selection itself will either be
        # included or excluded.
        steps = set()

        # Essentially a BFS where its stack gets initialized with multiple
        # root nodes.
        stack = [step for step in self.steps if step.properties['uuid'] in selection]

        while stack:
            step = stack.pop()
            if step in steps:
                continue

            steps.add(step)
            stack.extend(step.parents)

        if not inclusive:
            steps = [step for step in steps if step.properties['uuid'] not in selection]

        # TODO: note that the steps might have children that are not part
        #       of the pipeline itself. (They are kept from the old pipeline
        #       structure.) However, only the execute is run after this
        #       method where we only traverse by getting the parents.
        #       So for now it is not a big deal and makes the method faster.
        return Pipeline(steps=list(steps))

    async def run(self):
        # TODO: do we want to put this docker instance also inside the
        #       connections.py file? Similar to the standard docker
        #       sdk instance?
        docker = aiodocker.Docker()
        await self.sentinel.run(docker)
        await docker.close()

    def __repr__(self):
        return f'Pipeline({self.steps!r})'
