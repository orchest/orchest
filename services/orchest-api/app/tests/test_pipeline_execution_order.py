import asyncio
import json

import pytest
from aiodocker.containers import DockerContainers

from _orchest.internals import config as _config
from app.core import pipelines
from app.core.pipelines import Pipeline


class IO:
    def __init__(self, pipeline):
        self.pipeline = pipeline
        self.dependencies = dict()

        for step in pipeline.steps:
            self.dependencies[step.properties["uuid"]] = set(
                step.properties["incoming_connections"]
            )


def execution_order_correct(execution_order, dependencies):
    """Test if the execution order respected the DAG dependencies.

    Args:
        execution_order: execution order as a list of uuids
        dependencies: dict mapping a uuid to an iterable of parent uuids

    Returns:
        True if the execution order was correct, False otherwise.
    """
    # for each step verify that its dependencies have been run before
    # the step itself
    success = True
    executed_steps = set()
    for step in execution_order:
        for parent_step in dependencies[step]:
            if parent_step not in executed_steps:
                print(
                    f"parent step {parent_step} \
                            was not executed before {step}"
                )
                success = False

        executed_steps.add(step)

    return success


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
    return IO(pipeline)


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
        "session_uuid": "",
        "session_type": "",
        "project_dir": "",
        "pipeline_path": "",
        "pipeline_uuid": "",
        "project_uuid": "",
        "run_endpoint": None,
        "env_uuid_docker_id_mappings": MockEnvUUIDDockerIDMapping(),
        "host_user_dir": "",
        "user_env_variables": {},
    }
    asyncio.run(testio.pipeline.run(filler_for_task_id, run_config=run_config))

    assert execution_order_correct(execution_order, testio.dependencies)
