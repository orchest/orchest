"""

The pipeline looks as follows:
    step 1 --> step 2 --> step 3
                    |
                      --> step 4 --> step 5

               step 6
"""
import asyncio
from collections import defaultdict
import json

from aiodocker.containers import DockerContainer, DockerContainers
import pytest
import networkx as nx

from app.core import pipelines
from app.core.pipelines import Pipeline
from _orchest.internals import config as _config


class IO:
    def __init__(self, pipeline, possible_execution_orders):
        self.pipeline = pipeline
        self.possible_execution_orders = possible_execution_orders


def steps_to_networkx_digraph(steps):
    graph = defaultdict(list)
    for step_uuid, step_properties in steps.items():

        # needed for steps with no children
        if step_uuid not in graph:
            graph[step_uuid] = []

        for parent in step_properties["incoming_connections"]:
            graph[parent].append(step_uuid)
    return nx.DiGraph(graph)


def all_execution_orders(steps):
    """All possible execution orders as a generator of lists"""
    return nx.all_topological_sorts(steps_to_networkx_digraph(steps))


@pytest.fixture(
    params=[
        "pipeline-1.json",
        "pipeline-2.json",
        "pipeline-3.json",
        "pipeline-4.json",
        "pipeline-5.json",
        "pipeline-6.json",
        "pipeline-7.json",
        "pipeline-8.json",
        "pipeline-9.json",
    ]
)
def testio(request):
    full_name = f"tests/input_execution_order/{request.param}"
    with open(full_name, "r") as f:
        description = json.load(f)

    pipeline = Pipeline.from_json(description)
    possible_execution_orders = all_execution_orders(description["steps"])
    return IO(pipeline, possible_execution_orders)


class MockDockerContainer:
    def __init__(self, sleep_amount, uuid, execution_order):
        self.sleep_amount = sleep_amount
        self.uuid = uuid
        self.execution_order = execution_order

    async def wait(self):
        await asyncio.sleep(self.sleep_amount)
        self.execution_order.append(self.uuid)
        return {"StatusCode": 0}


def test_pipeline_run_call_order(testio, monkeypatch):
    async def mockreturn_run(*args, **kwargs):
        # It gets the config that get's passed to the
        # `aiodocker.Docker().containers.run(config=config)`
        mock_class = MockDockerContainer(
            float(
                kwargs["config"]["Image"].replace(
                    _config.ENVIRONMENT_IMAGE_NAME.format(
                        project_uuid="", environment_uuid=""
                    ),
                    "",
                )
            ),
            kwargs["config"]["tests-uuid"],
            execution_order,
        )

        return mock_class

    async def mockreturn_update_status(*args, **kwargs):
        return

    def mock_get_orchest_mounts(*args, **kwargs):
        return []

    def mock_get_volume_mount(*args, **kwargs):
        return []

    class MockEnvUUIDDockerIDMapping:
        def __getitem__(self, item):
            return str(item)

    # We use that the class will point to the same object list to write
    # the calling order to.
    execution_order = []

    monkeypatch.setattr(DockerContainers, "run", mockreturn_run)
    monkeypatch.setattr(pipelines, "update_status", mockreturn_update_status)
    monkeypatch.setattr(pipelines, "get_orchest_mounts", mock_get_orchest_mounts)
    monkeypatch.setattr(pipelines, "get_volume_mounts", mock_get_volume_mount)

    filler_for_task_id = "1"
    run_config = {
        "project_dir": None,
        "pipeline_path": "",
        "pipeline_uuid": "",
        "project_uuid": "",
        "run_endpoint": None,
        "env_uuid_docker_id_mappings": MockEnvUUIDDockerIDMapping(),
    }
    asyncio.run(testio.pipeline.run(filler_for_task_id, run_config=run_config))

    for order in testio.possible_execution_orders:
        # avoid comparing all solutions
        if execution_order == order:
            return

    # if the execution order is not among the possible orders then the
    # test failed
    assert False
