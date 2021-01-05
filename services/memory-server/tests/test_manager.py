import os
import subprocess
import time
from unittest.mock import patch

import numpy as np
import pytest

import orchest

# Add the folder to the path to not break imports. This has to do with
# imports that work differently when started via a subprocess.
# import sys
# sys.path.insert(0, os.path.abspath('app'))

KILOBYTE = 1 << 10
MEGABYTE = KILOBYTE * KILOBYTE

# NOTE: has to be multiple of 10, ie. 10, 100, etc.
PLASMA_KILOBYTES = 10
PLASMA_STORE_CAPACITY = PLASMA_KILOBYTES * KILOBYTE


def generate_data(total_size):
    nrows = int(total_size / np.dtype("float64").itemsize)
    return np.random.randn(nrows)


@pytest.fixture
def memory_store(monkeypatch):
    abs_path = os.path.dirname(os.path.abspath(__file__))
    script = os.path.join(abs_path, "..", "app", "main.py")

    store_socket_name = os.path.join(abs_path, "plasma.sock")
    pipeline_fname = os.path.join(abs_path, "pipeline.json")
    command = [
        "python",
        script,
        "-m",
        str(PLASMA_STORE_CAPACITY),
        "-s",
        f"{store_socket_name}",
        "-p",
        f"{pipeline_fname}",
    ]
    proc = subprocess.Popen(command, stdout=subprocess.PIPE)

    monkeypatch.setattr(orchest.Config, "STORE_SOCKET_NAME", store_socket_name)
    yield store_socket_name, pipeline_fname

    if proc.poll() is None:
        proc.kill()

    os.remove(store_socket_name)


@patch("orchest.transfer.get_step_uuid")
@patch("orchest.Config.STEP_DATA_DIR", "tests/userdir/.data/{step_uuid}")
def test_memory_eviction_fit(mock_get_step_uuid, memory_store, monkeypatch):
    store_socket_name, pipeline_fname = memory_store
    orchest.Config.PIPELINE_DEFINITION_PATH = pipeline_fname

    # Setup environment variables.
    envs = {"ORCHEST_MEMORY_EVICTION": "True"}
    monkeypatch.setattr(os, "environ", envs)

    # Do as if we are uuid-1
    data_1 = generate_data(0.6 * PLASMA_KILOBYTES * KILOBYTE)
    mock_get_step_uuid.return_value = "uuid-1______________"
    orchest.transfer.output_to_memory(
        data_1,
        name=None,
        disk_fallback=False,
    )

    # Do as if we are uuid-2
    mock_get_step_uuid.return_value = "uuid-2______________"
    input_data_2 = orchest.transfer.get_inputs(pipeline_fname)
    assert (input_data_2[orchest.Config._RESERVED_UNNAMED_OUTPUTS_STR] == data_1).all()

    # Pretend to be executing something.
    time.sleep(1)

    data_2 = generate_data(0.1 * PLASMA_KILOBYTES * KILOBYTE)
    orchest.transfer.output_to_memory(
        data_2,
        name=None,
        disk_fallback=False,
    )

    # Do as if we are uuid-3. It should fit in memory, since the receive
    # method here should evict the data from "uuid-1" afterwards.
    mock_get_step_uuid.return_value = "uuid-3______________"
    input_data_3 = orchest.transfer.get_inputs(pipeline_fname)
    assert (input_data_3[orchest.Config._RESERVED_UNNAMED_OUTPUTS_STR] == data_1).all()

    # Pretend to be executing something.
    time.sleep(1)

    data_3 = generate_data(0.6 * PLASMA_KILOBYTES * KILOBYTE)
    res = orchest.transfer.output_to_memory(
        data_3,
        name=None,
        disk_fallback=False,
    )

    assert res is None


@patch("orchest.transfer.get_step_uuid")
@patch("orchest.Config.STEP_DATA_DIR", "tests/userdir/.data/{step_uuid}")
def test_memory_eviction_memoryerror(mock_get_step_uuid, memory_store):
    store_socket_name, pipeline_fname = memory_store

    orchest.Config.PIPELINE_DEFINITION_PATH = pipeline_fname

    # Do as if we are uuid-1
    data_1 = generate_data(0.6 * PLASMA_KILOBYTES * KILOBYTE)
    mock_get_step_uuid.return_value = "uuid-1______________"
    orchest.transfer.output_to_memory(
        data_1,
        name=None,
        disk_fallback=False,
    )

    # Do as if we are uuid-2
    mock_get_step_uuid.return_value = "uuid-2______________"
    input_data_2 = orchest.transfer.get_inputs(pipeline_fname)
    assert (input_data_2[orchest.Config._RESERVED_UNNAMED_OUTPUTS_STR] == data_1).all()

    # Pretend to be executing something.
    time.sleep(1)

    data_2 = generate_data(0.1 * PLASMA_KILOBYTES * KILOBYTE)
    orchest.transfer.output_to_memory(
        data_2,
        name=None,
        disk_fallback=False,
    )

    # Do as if we are uuid-3. It should fit in memory, since the receive
    # method here should evict the data from "uuid-1" afterwards.
    mock_get_step_uuid.return_value = "uuid-3______________"
    input_data_3 = orchest.transfer.get_inputs(pipeline_fname)
    assert (input_data_3[orchest.Config._RESERVED_UNNAMED_OUTPUTS_STR] == data_1).all()

    # Pretend to be executing something.
    time.sleep(1)

    data_3 = generate_data(0.6 * PLASMA_KILOBYTES * KILOBYTE)
    with pytest.raises(MemoryError):
        orchest.transfer.output_to_memory(
            data_3,
            name=None,
            disk_fallback=False,
        )
