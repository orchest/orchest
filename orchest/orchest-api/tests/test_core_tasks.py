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

import pytest

from app.core.tasks import Pipeline, run_partial


@pytest.fixture
def description():
    with open('tests/pipeline.json', 'r') as f:
        description = json.load(f)

    return description


@pytest.fixture
def description_straight():
    with open('tests/pipeline-straight.json', 'r') as f:
        description_straight = json.load(f)

    return description_straight


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

    # TODO: this will currently still fail, since it has children
    #       step-3 and step-4. But not sure yet what we want.
    # assert steps['step-2']._children == []
    assert steps['step-2'].parents == [steps['step-1']]

    # Testing the inclusive kwarg.
    incoming_inclusive = pipeline.incoming(['uuid-4', 'uuid-6'], inclusive=True)
    steps = {step.properties['name']: step for step in incoming_inclusive.steps}

    assert steps['step-1']._children == [steps['step-2']]
    assert steps['step-1'].parents == []

    # TODO: this will currently still fail, since it has children
    #       step-3 and step-4. But not sure yet what we want.
    #       Similarly for the step-4 children.
    # assert steps['step-2']._children == []
    assert steps['step-2'].parents == [steps['step-1']]

    assert steps['step-4'].parents == [steps['step-2']]
    # assert steps['step-4']._children == []

    assert steps['step-6']._children == []
    assert steps['step-6'].parents == []


def test_pipeline_run(description):
    # TODO: Check whether the graph execution is resolved correctly.
    #       e.g. it should run step-1 and step-6 in parallel and only
    #       start on step-2 once step-1 has finished computing.
    pipeline = Pipeline.from_json(description)
    asyncio.run(pipeline.run())


# ---- Make sure to start a Celery worker before running the tests below.

# TODO: use parametrized docker containers that do a time.sleep() Then
#       we can check whether everything is executed in the correct order.
# def test_run_partial(description):
#     # TODO: Check whether the graph execution is resolved correctly.
#     #       e.g. it should run step-1 and step-6 in parallel and only
#     #       start on step-2 once step-1 has finished computing.
#     run_partial.delay([], 'full', description)


# Uncomment this method and start a celery worker to verify that this
# tasks indeed takes longer than the task with the regular pipeline
# description. This lets us believe that the regular graph is indeed
# executed in parallel. Whether it is indeed correctly resolved, we
# cannot conclude from this test.
# def test_run_partial(description_straight):
#     run_partial.delay([], 'full', description_straight)
