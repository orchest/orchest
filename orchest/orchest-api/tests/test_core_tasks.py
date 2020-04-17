"""

The pipeline looks as follows:
    step 1 --> step 2 --> step 3
                    |
                      --> step 4 --> step 5

               step 6
"""
import json
import unittest

import pytest

from app.core.tasks import Pipeline


@pytest.fixture
def description():
    with open('tests/pipeline.json', 'r') as f:
        description = json.load(f)

    return description


def test_pipeline_from_json(description):
    pipeline = Pipeline.from_json(description)
    steps = {step.properties['name']: step for step in pipeline.steps}

    # pipeline = Pipeline(steps=list(steps.values()))
    # steps = {step.properties['name']: step for step in pipeline.steps}

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


def test_pipeline_get_subgraph(description):
    pipeline = Pipeline.from_json(description)

    subgraph = pipeline.get_subgraph(['uuid-2', 'uuid-4', 'uuid-6'])
    steps = {step.properties['name']: step for step in subgraph.steps}

    assert len(steps) == 3

    assert steps['step-2']._children == [steps['step-4']]
    assert steps['step-2'].parents == []

    assert steps['step-4']._children == []
    assert steps['step-4'].parents == [steps['step-2']]

    assert steps['step-6']._children == []
    assert steps['step-6'].parents == []


def test_pipeline_incoming(description):
    pass


def test_pipeline_execution(description):
    pass
