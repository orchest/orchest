import asyncio

import aiodocker

from app import celery


@celery.task
def add(x, y):
    return x + y


@celery.task
def run_partial(uuids, type_of_run, pipeline_description):
    """Runs a pipeline partially.

    Args:
        uuids (iterable): sequence of pipeline step UUIDS.
        type_of_run (str): one of ("full", "selection", "incoming").
        pipeline_description (dict): json describing pipeline.
    """
    # TODO: this function does not yet exist. It should return the graph
    #       to be run given by the uuids, type of run and pipeline
    #       description.
    pipeline = get_pipeline_to_execute(uuids, type_of_run, pipeline_description)

    # Run the subgraph in parallel.
    asyncio.run(pipeline.execute())


def get_pipeline_to_execute(uuids, type_of_run, pipeline_description):
    if type_of_run == 'full':
        return Pipeline.from_json(pipeline_description)

    if type_of_run == 'selection':
        # Remove all steps from the pipeline, that are not including in
        # the uuids iterable.

        # It is done like this because if a--> b is selected then the
        # order should be kept in mind. We cannot simply execute a and
        # b as if they are independent.
        return Pipeline.from_json(pipeline_description).keep(uuids)

    if type_of_run == 'incoming':
        return Pipeline.from_json(pipeline_description).incoming(uuids)


# OUTSIDE: allows for a selection of one step, to create the step and
# execute it.
class PipelineStep:
    def __init__(self, properties: dict, parents: list = None):
        self.properties = properties
        self.parents = parents if parents is not None else []

        self._children = []

    def __hash__(self):
        return hash(self.properties['uuid'])

    def __repr__(self):
        return f'<PipelineStep: {self.properties["name"]}>'

    async def execute_single(self, docker, wait_on_completion=True):
        config = {'Image': self.properties['image']['image_name']}

        container = await docker.containers.run(config=config)

        if wait_on_completion:
            await container.wait()

    async def execute(self, docker):
        tasks = [asyncio.create_task(parent.execute()) for parent in self.parents]
        await asyncio.gather(*tasks)

        await self.execute_single(docker)


class Pipeline:
    def __init__(self, steps=None):
        self.steps = steps

        # TODO: when initializing from file, set the sentinel.
        self._sentinel: PipelineStep = None

    @classmethod
    def from_json(cls, description):
        """
        Args:
            description (dict): json description of Pipeline.
        """
        # Can be thought of as an alternative constructor
        steps = {uuid: PipelineStep(properties) for uuid, properties in description['steps'].items()}

        for _, step in steps.items():
            step.parents = [steps[uuid] for uuid in step.properties['incoming_connections']]

            for uuid in step.properties['incoming_connections']:
                step.parents.append(steps[uuid])
                steps[uuid]._children.append(step)

        return cls(list(steps.values()))

    @property
    def sentinel(self):
        if self._sentinel is None:
            self._sentinel = PipelineStep(None)
            self._sentinel.parents = [step for step in self.steps if not step._children]

        return self._sentinel

    def keep(self, nodes):
        # Modifies inplace!

        # TODO: the connection from nodes to non-existing nodes should be
        #       removed.
        self.steps = [step for step in self.steps if step in steps]

    def get_subgraph(self, steps):
        # Same as .keep() but returns new Pipeline object.
        return Pipeline(steps=[step for step in self.steps if step in steps])

    def incoming(self, selection):
        # TODO: take a--> b --> c where selection=[b, c]. Then b would
        #       also be in the steps to be executed. Do we want this?

        # Traverses the Pipeline starting at the nodes given by selection.
        # BFS starting at multiple nodes.

        steps = set()

        # Get steps that are given by the selection.
        stack = [step for step in self.steps if step.properties['uuid'] in selection]

        # Get all the parents of all the steps in the selection.
        while stack:
            step = stack.pop()
            if step in steps:
                continue

            steps.add(step)
            stack.extend(step.parents)

        # Note that the nodes in the selection are now also run.
        return Pipeline(steps=list(steps))

    async def execute(self):
        docker = aiodocker.Docker()
        await self.sentinel.execute(docker)
        await docker.close()
