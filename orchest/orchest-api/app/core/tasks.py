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
        return Pipeline.initialize_from_file(pipeline_description)

    if type_of_run == 'selection':
        # Remove all steps from the pipeline, that are not including in
        # the uuids iterable.

        # It is done like this because if a--> b is selected then the
        # order should be kept in mind. We cannot simply execute a and
        # b as if they are independent.
        return Pipeline.initialize_from_file(pipeline_description).keep(uuids)

    if type_of_run == 'incoming':
        return Pipeline.initialize_from_file(pipeline_description).incoming(uuids)


# OUTSIDE: allows for a selection of one step, to create the step and
# execute it.
class Step:
    def __init__(self):
        self.parents = []
        self.container_image: str = None

    async def execute_single(self, docker, wait=True):
        config = {'Image': self.container_image}

        container = await docker.containers.run(config=config)

        if wait:
            await container.wait()

    async def execute(self, docker):
        tasks = [asyncio.create_task(parent.execute()) for parent in self.parents]
        await asyncio.gather(*tasks)

        await self.execute_single(docker)


class Pipeline:
    def __init__(self, nodes=None):
        self.nodes = nodes

        # TODO: when initializing from file, set the sentinel.
        self._sentinel: Step = None

    @classmethod
    def initialize_from_file(cls, json):
        # Can be thought of as an alternative constructor
        nodes = [Step()]
        # TODO: set the sentinel.
        return cls(nodes)

    def keep(self, nodes):
        # Modifies inplace!

        # TODO: the connection from nodes to non-existing nodes should be
        #       removed.
        self.nodes = [node for node in self.nodes if node in nodes]

    def get_subgraph(self, nodes):
        return Pipeline(nodes=[node for node in self.nodes if node in nodes])

    def incoming(self, selection):
        nodes = set()

        queue = selection[:]
        while queue:
            node = queue.pop()
            if node in nodes:
                continue

            nodes.add(node)
            queue.extend(node.parents)

        # Note that the nodes in the selection are now also run.
        return Pipeline(nodes=list(nodes))

    async def execute(self):
        docker = aiodocker.Docker()
        await self._sentinel.execute(docker)
        await docker.close()
