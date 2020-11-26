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

from app.core import pipelines
from app.core.pipelines import Pipeline


@pytest.fixture
def pipeline():
    with open("tests/input_operations/pipeline.json", "r") as f:
        description = json.load(f)

    pipeline = Pipeline.from_json(description)
    return pipeline


def test_serialization():
    with open("tests/input_operations/pipeline.json", "r") as f:
        description = json.load(f)

    pipeline = Pipeline.from_json(description)
    assert pipeline.to_dict() == description


def test_pipeline_from_json(pipeline):
    steps = {step.properties["name"]: step for step in pipeline.steps}

    assert steps["step-1"]._children == [steps["step-2"]]
    assert steps["step-1"].parents == []

    case = unittest.TestCase()
    case.assertCountEqual(steps["step-2"]._children, [steps["step-4"], steps["step-3"]])
    assert steps["step-2"].parents == [steps["step-1"]]

    assert steps["step-3"]._children == []
    assert steps["step-3"].parents == [steps["step-2"]]

    assert steps["step-4"]._children == [steps["step-5"]]
    assert steps["step-4"].parents == [steps["step-2"]]

    assert steps["step-5"]._children == []
    assert steps["step-5"].parents == [steps["step-4"]]

    assert steps["step-6"]._children == []
    assert steps["step-6"].parents == []


def test_pipeline_sentinel(pipeline):
    steps = {step.properties["name"]: step for step in pipeline.steps}

    case = unittest.TestCase()
    correct_children = [steps["step-1"], steps["step-6"]]
    case.assertCountEqual(pipeline.sentinel._children, correct_children)


def test_pipeline_get_induced_subgraph(pipeline):
    subgraph = pipeline.get_induced_subgraph(["uuid-2", "uuid-4", "uuid-6"])
    steps = {step.properties["name"]: step for step in subgraph.steps}

    assert len(steps) == 3

    assert steps["step-2"]._children == [steps["step-4"]]
    assert steps["step-2"].parents == []

    assert steps["step-4"]._children == []
    assert steps["step-4"].parents == [steps["step-2"]]

    assert steps["step-6"]._children == []
    assert steps["step-6"].parents == []


def test_pipeline_incoming(pipeline):
    incoming = pipeline.incoming(["uuid-4", "uuid-6"], inclusive=False)
    steps = {step.properties["name"]: step for step in incoming.steps}

    assert steps["step-1"]._children == [steps["step-2"]]
    assert steps["step-1"].parents == []

    assert steps["step-2"]._children == []
    assert steps["step-2"].parents == [steps["step-1"]]

    # Testing the inclusive kwarg.
    incoming_inclusive = pipeline.incoming(
        ["uuid-3", "uuid-4", "uuid-6"], inclusive=True
    )
    steps = {step.properties["name"]: step for step in incoming_inclusive.steps}

    assert steps["step-1"]._children == [steps["step-2"]]
    assert steps["step-1"].parents == []

    case = unittest.TestCase()
    case.assertCountEqual(steps["step-2"]._children, [steps["step-4"], steps["step-3"]])
    assert steps["step-2"].parents == [steps["step-1"]]

    assert steps["step-3"].parents == [steps["step-2"]]
    assert steps["step-3"]._children == []

    assert steps["step-4"].parents == [steps["step-2"]]
    assert steps["step-4"]._children == []

    assert steps["step-6"]._children == []
    assert steps["step-6"].parents == []


@pytest.mark.skip(
    reason='Problem is that the config takes "Cmd" which '
    "the hello-world container does not"
)
def test_pipeline_run_with_docker_containers(pipeline, monkeypatch):
    async def mockreturn_update_status(*args, **kwargs):
        return

    monkeypatch.setattr(pipelines, "update_status", mockreturn_update_status)

    # TODO: the pipeline.run will take a config. This config then also
    #       contains a mapping that specifies what image to use.
    filler_for_task_id = "1"
    run_config = {
        "project_dir": None,
    }
    asyncio.run(pipeline.run(filler_for_task_id, run_config=run_config))
