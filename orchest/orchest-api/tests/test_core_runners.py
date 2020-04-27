"""

The pipeline looks as follows:
    step 1 --> step 2 --> step 3
                    |
                      --> step 4 --> step 5

               step 6
"""
import asyncio
import json
import unittest

from aiodocker.containers import DockerContainer, DockerContainers
import pytest

from app.core.runners import Pipeline


@pytest.fixture
def description():
    with open('tests/pipeline.json', 'r') as f:
        description = json.load(f)

    return description


@pytest.fixture
def description_resolve():
    with open('tests/pipeline-resolve.json', 'r') as f:
        description_resolve = json.load(f)

    return description_resolve


def test_pipeline_from_json(description):
    pipeline = Pipeline.from_json(description)
    steps = {step.properties['name']: step for step in pipeline.steps}

    assert steps['step-1']._children == [steps['step-2']]
    assert steps['step-1'].parents == []

    case = unittest.TestCase()
    case.assertCountEqual(steps['step-2']._children, [steps['step-4'], steps['step-3']])
    assert steps['step-2'].parents == [steps['step-1']]

    assert steps['step-3']._children == []
    assert steps['step-3'].parents == [steps['step-2']]

    assert steps['step-4']._children == [steps['step-5']]
    assert steps['step-4'].parents == [steps['step-2']]

    assert steps['step-5']._children == []
    assert steps['step-5'].parents == [steps['step-4']]

    assert steps['step-6']._children == []
    assert steps['step-6'].parents == []


def test_pipeline_sentinel(description):
    pipeline = Pipeline.from_json(description)
    steps = {step.properties['name']: step for step in pipeline.steps}

    case = unittest.TestCase()
    correct_parents = [steps['step-3'], steps['step-5'], steps['step-6']]
    case.assertCountEqual(pipeline.sentinel.parents, correct_parents)


def test_pipeline_get_induced_subgraph(description):
    pipeline = Pipeline.from_json(description)

    subgraph = pipeline.get_induced_subgraph(['uuid-2', 'uuid-4', 'uuid-6'])
    steps = {step.properties['name']: step for step in subgraph.steps}

    assert len(steps) == 3

    assert steps['step-2']._children == [steps['step-4']]
    assert steps['step-2'].parents == []

    assert steps['step-4']._children == []
    assert steps['step-4'].parents == [steps['step-2']]

    assert steps['step-6']._children == []
    assert steps['step-6'].parents == []


def test_pipeline_incoming(description):
    pipeline = Pipeline.from_json(description)

    incoming = pipeline.incoming(['uuid-4', 'uuid-6'], inclusive=False)
    steps = {step.properties['name']: step for step in incoming.steps}

    assert steps['step-1']._children == [steps['step-2']]
    assert steps['step-1'].parents == []

    assert steps['step-2']._children == []
    assert steps['step-2'].parents == [steps['step-1']]

    # Testing the inclusive kwarg.
    incoming_inclusive = pipeline.incoming(['uuid-3', 'uuid-4', 'uuid-6'], inclusive=True)
    steps = {step.properties['name']: step for step in incoming_inclusive.steps}

    assert steps['step-1']._children == [steps['step-2']]
    assert steps['step-1'].parents == []

    case = unittest.TestCase()
    case.assertCountEqual(steps['step-2']._children, [steps['step-4'], steps['step-3']])
    assert steps['step-2'].parents == [steps['step-1']]

    assert steps['step-3'].parents == [steps['step-2']]
    assert steps['step-3']._children == []

    assert steps['step-4'].parents == [steps['step-2']]
    assert steps['step-4']._children == []

    assert steps['step-6']._children == []
    assert steps['step-6'].parents == []


# TODO: for the two tests below we have to mock the update_status call
#       of the PipelineStepRunner such that it does not call the API
#       and just does nothing. Also give the pipeline.run a task_id
def test_pipeline_run_with_docker_containers(description):
    pipeline = Pipeline.from_json(description)
    asyncio.run(pipeline.run())


CALLING_ORDER = []


class MockDockerContainer:
    def __init__(self, sleep_amount, uuid):
        self.sleep_amount = sleep_amount
        self.uuid = uuid

    async def wait(self):
        await asyncio.sleep(self.sleep_amount)
        CALLING_ORDER.append(self.uuid)


def test_pipeline_run_call_order(description_resolve, monkeypatch):
    async def mockreturn_run(*args, **kwargs):
        # It gets the config that get's passed to the
        # `aiodocker.Docker().containers.run(config=config)`
        mock_class = MockDockerContainer(kwargs['config']['Image'],
                                         kwargs['config']['uuid'])

        return mock_class

    pipeline = Pipeline.from_json(description_resolve)

    monkeypatch.setattr(DockerContainers, 'run', mockreturn_run)
    asyncio.run(pipeline.run())
    assert CALLING_ORDER == ['uuid-1', 'uuid-2', 'uuid-4', 'uuid-3', 'uuid-6', 'uuid-5']


# ---- Make sure to start a Celery worker before running the tests below.
# def test_run_partial_on_celery(description):
#     from app.core.runners import run_partial
#     run_partial.delay([], 'full', description)
