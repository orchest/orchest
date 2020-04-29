"""

The pipeline looks as follows:
    step 1 --> step 2 --> step 3
                    |
                      --> step 4 --> step 5

               step 6
"""
import asyncio
import json

from aiodocker.containers import DockerContainer, DockerContainers
import pytest

from app.core import runners
from app.core.runners import Pipeline


class TestCase:
    def __init__(self, pipeline, correct_execution_order):
        self.pipeline = pipeline
        self.correct_execution_order = correct_execution_order


@pytest.fixture(params=[
    'pipeline-1.json',
    'pipeline-2.json',
    'pipeline-3.json',
    'pipeline-4.json',
    'pipeline-5.json',
    'pipeline-6.json',
])
def testio(request):
    full_name = f'tests/input_execution_order/{request.param}'
    with open(full_name, 'r') as f:
        description = json.load(f)

    pipeline = Pipeline.from_json(description)
    correct_execution_order = description['correct_execution_order']
    return TestCase(pipeline, correct_execution_order)


class MockDockerContainer:
    def __init__(self, sleep_amount, uuid, execution_order):
        self.sleep_amount = sleep_amount
        self.uuid = uuid
        self.execution_order = execution_order

    async def wait(self):
        await asyncio.sleep(self.sleep_amount)
        self.execution_order.append(self.uuid)


def test_pipeline_run_call_order(testio, monkeypatch):
    async def mockreturn_run(*args, **kwargs):
        # It gets the config that get's passed to the
        # `aiodocker.Docker().containers.run(config=config)`
        mock_class = MockDockerContainer(kwargs['config']['Image'],
                                         kwargs['config']['uuid'],
                                         execution_order)

        return mock_class

    async def mockreturn_update_status(*args, **kwargs):
        return

    # We use that the class will point to the same object list to write
    # the calling order to.
    execution_order = []

    monkeypatch.setattr(DockerContainers, 'run', mockreturn_run)
    monkeypatch.setattr(runners, 'update_status', mockreturn_update_status)

    filler_for_task_id = '1'
    asyncio.run(testio.pipeline.run(filler_for_task_id))

    assert execution_order == testio.correct_execution_order
