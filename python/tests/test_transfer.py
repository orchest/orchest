"""
uuid-1, uuid-3 --> uuid-2
"""
import os
import shutil
import time
from unittest.mock import patch

import numpy as np
import pyarrow as pa
import pyarrow.plasma as plasma
import pytest

import orchest
from orchest import transfer


KILOBYTE = 1 << 10
MEGABYTE = KILOBYTE * KILOBYTE

# NOTE: has to be multiple of 10, ie. 10, 100, etc.
PLASMA_KILOBYTES = 10
PLASMA_STORE_CAPACITY = PLASMA_KILOBYTES * KILOBYTE


def generate_data(total_size):
    nrows = int(total_size / np.dtype('float64').itemsize)
    return np.random.randn(nrows)


class UnserializableByPyarrowObject:
    def __init__(self, x):
        self.x = x

    def __eq__(self, other):
        if isinstance(self.x, np.ndarray) and isinstance(other.x, np.ndarray):
            return (self.x == other.x).all()

        return self.x == other.x


@pytest.fixture()
def plasma_store(monkeypatch):
    with plasma.start_plasma_store(PLASMA_STORE_CAPACITY) as info:
        store_socket_name, _ = info
        monkeypatch.setattr(orchest.Config, 'STORE_SOCKET_NAME', store_socket_name)
        yield store_socket_name

    uuids = [
        'uuid-1______________',
        'uuid-2______________',
        'uuid-3______________'
    ]

    for step_uuid in uuids:
        shutil.rmtree(f'tests/userdir/.data/{step_uuid}', ignore_errors=True)


def test_assert_object_is_unserializable_by_pyarrow():
    """Tests whether pyarrow is unable to serialize a custom object.

    We have to make sure pyarrow did not add code that it can now
    serialize custom objects. Since then the fallback code to pickle is
    never called and therefore not tested.
    """
    with pytest.raises(pa.lib.SerializationCallbackError):
        pa.serialize(UnserializableByPyarrowObject(1))

    with pytest.raises(pa.lib.SerializationCallbackError):
        pa.serialize(UnserializableByPyarrowObject(np.array([1])))


@pytest.mark.parametrize('data_1', [
        generate_data(KILOBYTE),
        np.array([UnserializableByPyarrowObject(1) for _ in range(3)]),
    ],
    ids=['basic', 'pickle']
)
@pytest.mark.parametrize('test_transfer', [
        {
            'method': transfer.output_to_disk,
            'kwargs': {
                'pickle_fallback': True
            }
        },
    ],
    ids=['default']
)
@patch('orchest.transfer.get_step_uuid')
@patch('orchest.Config.STEP_DATA_DIR', 'tests/userdir/.data/{step_uuid}')
def test_disk(mock_get_step_uuid, data_1, test_transfer, plasma_store):
    # Do as if we are uuid-1. Note the trailing underscores. This is to
    # make the plasma.ObjectID the required 20 characters.
    mock_get_step_uuid.return_value = 'uuid-1______________'

    test_transfer['method'](
        data_1,
        pipeline_description_path='tests/userdir/pipeline-basic.json',
        **test_transfer['kwargs']
    )

    # Do as if we are uuid-2
    mock_get_step_uuid.return_value = 'uuid-2______________'
    input_data = transfer.get_inputs('tests/userdir/pipeline-basic.json')

    assert (input_data == data_1).all()


# TODO: add tests for other kwargs
@pytest.mark.parametrize('data_1', [
        generate_data(KILOBYTE),
        np.array([UnserializableByPyarrowObject(1) for _ in range(3)]),
    ],
    ids=['basic', 'pickle']
)
@pytest.mark.parametrize('test_transfer', [
        {
            'method': transfer.output_to_memory,
            'kwargs': {
                'disk_fallback': False,
            }
        }
    ],
    ids=['disk_fallback=False']
)
@patch('orchest.transfer.get_step_uuid')
@patch('orchest.Config.STEP_DATA_DIR', 'tests/userdir/.data/{step_uuid}')
def test_memory(mock_get_step_uuid, data_1, test_transfer, plasma_store):

    # Do as if we are uuid-1. Note the trailing underscores. This is to
    # make the plasma.ObjectID the required 20 characters.
    mock_get_step_uuid.return_value = 'uuid-1______________'
    test_transfer['method'](
        data_1,
        pipeline_description_path='tests/userdir/pipeline-basic.json',
        **test_transfer['kwargs']
    )

    # Do as if we are uuid-2
    mock_get_step_uuid.return_value = 'uuid-2______________'
    input_data = transfer.get_inputs('tests/userdir/pipeline-basic.json')

    assert (input_data == data_1).all()


@patch('orchest.transfer.get_step_uuid')
@patch('orchest.Config.STEP_DATA_DIR', 'tests/userdir/.data/{step_uuid}')
def test_memory_out_of_memory(mock_get_step_uuid, plasma_store):
    data_1 = generate_data((PLASMA_KILOBYTES + 1) * KILOBYTE)
    data_size = pa.serialize(data_1).total_bytes
    assert data_size > PLASMA_STORE_CAPACITY

    # Do as if we are uuid-1
    mock_get_step_uuid.return_value = 'uuid-1______________'

    with pytest.raises(MemoryError):
        transfer.output_to_memory(
            data_1,
            disk_fallback=False,
            pipeline_description_path='tests/userdir/pipeline-basic.json'
        )


@patch('orchest.transfer.get_step_uuid')
@patch('orchest.Config.STEP_DATA_DIR', 'tests/userdir/.data/{step_uuid}')
def test_memory_disk_fallback(mock_get_step_uuid, plasma_store):
    # Do as if we are uuid-1
    data_1 = generate_data((PLASMA_KILOBYTES + 1) * KILOBYTE)
    data_size = pa.serialize(data_1).total_bytes
    assert data_size > PLASMA_STORE_CAPACITY

    mock_get_step_uuid.return_value = 'uuid-1______________'
    transfer.output_to_memory(
        data_1,
        disk_fallback=True,
        pipeline_description_path='tests/userdir/pipeline-basic.json'
    )

    # Do as if we are uuid-2
    mock_get_step_uuid.return_value = 'uuid-2______________'
    input_data = transfer.get_inputs('tests/userdir/pipeline-basic.json')

    assert (input_data[0] == data_1).all()


@patch('orchest.transfer.get_step_uuid')
@patch('orchest.Config.STEP_DATA_DIR', 'tests/userdir/.data/{step_uuid}')
def test_memory_pickle_fallback_and_disk_fallback(mock_get_step_uuid, plasma_store):
    data_1 = [
        UnserializableByPyarrowObject(generate_data(KILOBYTE))
        for _ in range(PLASMA_KILOBYTES + 1)
    ]
    serialized, _ = transfer.serialize(data_1)
    assert serialized.total_bytes > PLASMA_STORE_CAPACITY

    # Do as if we are uuid-1
    mock_get_step_uuid.return_value = 'uuid-1______________'
    transfer.output_to_memory(
        data_1,
        disk_fallback=True,
        pipeline_description_path='tests/userdir/pipeline-basic.json'
    )

    # Do as if we are uuid-2
    mock_get_step_uuid.return_value = 'uuid-2______________'
    input_data = transfer.get_inputs('tests/userdir/pipeline-basic.json')

    assert input_data[0] == data_1


# TODO: probably can parametrize this test as well
@patch('orchest.transfer.get_step_uuid')
@patch('orchest.Config.STEP_DATA_DIR', 'tests/userdir/.data/{step_uuid}')
def test_memory_eviction_fit(mock_get_step_uuid, plasma_store, monkeypatch):
    # breakpoint()

    # Setup environment variables.
    envs = {
        'PLASMA_MANAGER': 'True'
    }
    monkeypatch.setattr(os, 'environ', envs)

    # Do as if we are uuid-1
    data_1 = generate_data(0.6*PLASMA_KILOBYTES * KILOBYTE)
    mock_get_step_uuid.return_value = 'uuid-1______________'
    transfer.output_to_memory(
        data_1,
        disk_fallback=False,
        pipeline_description_path='tests/userdir/pipeline-eviction.json'
    )

    # Do as if we are uuid-2
    mock_get_step_uuid.return_value = 'uuid-2______________'
    input_data_2 = transfer.get_inputs('tests/userdir/pipeline-eviction.json')
    assert (input_data_2[0] == data_1).all()

    # Pretend to be executing something.
    time.sleep(1)

    data_2 = generate_data(0.1*PLASMA_KILOBYTES * KILOBYTE)
    transfer.output_to_memory(
        data_2,
        disk_fallback=False,
        pipeline_description_path='tests/userdir/pipeline-eviction.json'
    )

    # Do as if we are uuid-3. It should fit in memory, since the receive
    # method here should evict the data from "uuid-1" afterwards.
    mock_get_step_uuid.return_value = 'uuid-3______________'
    input_data_3 = transfer.get_inputs('tests/userdir/pipeline-eviction.json')
    assert (input_data_3[0] == data_1).all()

    # Pretend to be executing something.
    time.sleep(1)

    data_3 = generate_data(0.6*PLASMA_KILOBYTES * KILOBYTE)
    res = transfer.output_to_memory(
        data_3,
        disk_fallback=False,
        pipeline_description_path='tests/userdir/pipeline-eviction.json'
    )

    assert res is None


@patch('orchest.transfer.get_step_uuid')
@patch('orchest.Config.STEP_DATA_DIR', 'tests/userdir/.data/{step_uuid}')
def test_memory_eviction_memoryerror(mock_get_step_uuid, plasma_store):
    # Do as if we are uuid-1
    data_1 = generate_data(0.2*PLASMA_KILOBYTES * KILOBYTE)
    mock_get_step_uuid.return_value = 'uuid-1______________'
    transfer.output_to_memory(
        data_1,
        disk_fallback=False,
        pipeline_description_path='tests/userdir/pipeline-eviction.json'
    )

    # Do as if we are uuid-2
    mock_get_step_uuid.return_value = 'uuid-2______________'
    input_data_2 = transfer.get_inputs('tests/userdir/pipeline-eviction.json')
    assert (input_data_2[0] == data_1).all()

    # Pretend to be executing something.
    time.sleep(1)

    data_2 = generate_data(0.6*PLASMA_KILOBYTES * KILOBYTE)
    transfer.output_to_memory(
        data_2,
        disk_fallback=False,
        pipeline_description_path='tests/userdir/pipeline-eviction.json'
    )

    # Do as if we are uuid-3. It should fit in memory, since the receive
    # method here should evict the data from "uuid-1" afterwards.
    mock_get_step_uuid.return_value = 'uuid-3______________'
    input_data_3 = transfer.get_inputs('tests/userdir/pipeline-eviction.json')
    assert (input_data_3[0] == data_1).all()

    # Pretend to be executing something.
    time.sleep(1)

    data_3 = generate_data(0.6*PLASMA_KILOBYTES * KILOBYTE)
    with pytest.raises(MemoryError):
        transfer.output_to_memory(
            data_3,
            disk_fallback=False,
            pipeline_description_path='tests/userdir/pipeline-eviction.json'
        )


@patch('orchest.transfer.get_step_uuid')
@patch('orchest.Config.STEP_DATA_DIR', 'tests/userdir/.data/{step_uuid}')
def test_resolve_disk_then_memory(mock_get_step_uuid, plasma_store):
    # Do as if we are uuid-1.
    mock_get_step_uuid.return_value = 'uuid-1______________'

    data_1 = generate_data(KILOBYTE)
    transfer.output_to_disk(
        data_1,
        pipeline_description_path='tests/userdir/pipeline-basic.json'
    )

    # It is very unlikely you will output through memory and disk in quick
    # succession. In addition, the resolve order has a precision of
    # seconds. Thus we need to ensure that indeed it can be resolved.
    time.sleep(1)

    data_1_new = generate_data(KILOBYTE)
    transfer.output_to_memory(
        data_1_new,
        disk_fallback=False,
        pipeline_description_path='tests/userdir/pipeline-basic.json'
    )

    # Do as if we are uuid-2
    mock_get_step_uuid.return_value = 'uuid-2______________'
    input_data = transfer.get_inputs('tests/userdir/pipeline-basic.json')

    assert (input_data[0] == data_1_new).all()


@patch('orchest.transfer.get_step_uuid')
@patch('orchest.Config.STEP_DATA_DIR', 'tests/userdir/.data/{step_uuid}')
def test_resolve_memory_then_disk(mock_get_step_uuid, plasma_store):
    # Do as if we are uuid-1.
    mock_get_step_uuid.return_value = 'uuid-1______________'

    data_1 = generate_data(KILOBYTE)
    transfer.output_to_memory(
        data_1,
        disk_fallback=False,
        pipeline_description_path='tests/userdir/pipeline-basic.json'
    )

    # It is very unlikely you will output through memory and disk in quick
    # succession. In addition, the resolve order has a precision of
    # seconds. Thus we need to ensure that indeed it can be resolved.
    time.sleep(1)

    data_1_new = generate_data(KILOBYTE)
    transfer.output_to_disk(
        data_1_new,
        pipeline_description_path='tests/userdir/pipeline-basic.json'
    )

    # Do as if we are uuid-2
    mock_get_step_uuid.return_value = 'uuid-2______________'
    input_data = transfer.get_inputs('tests/userdir/pipeline-basic.json')

    assert (input_data[0] == data_1_new).all()


@patch('orchest.transfer.get_step_uuid')
@patch('orchest.Config.STEP_DATA_DIR', 'tests/userdir/.data/{step_uuid}')
def test_receive_input_order(mock_get_step_uuid, plasma_store):
    """Test the order of the inputs of the receiving step.

    Note that the order in which the data is output does not determine the
    "receive order", it is the order in which it is defined in the
    pipeline.json (for the "incoming-connections").
    """
    # Do as if we are uuid-3
    data_3 = generate_data(KILOBYTE)
    mock_get_step_uuid.return_value = 'uuid-3______________'
    transfer.output_to_memory(
        data_3,
        pipeline_description_path='tests/userdir/pipeline-order.json'
    )

    # Do as if we are uuid-1
    data_1 = generate_data(KILOBYTE)
    mock_get_step_uuid.return_value = 'uuid-1______________'
    transfer.output_to_memory(
        data_1,
        pipeline_description_path='tests/userdir/pipeline-order.json'
    )

    # Do as if we are uuid-2
    mock_get_step_uuid.return_value = 'uuid-2______________'
    input_data = transfer.get_inputs('tests/userdir/pipeline-order.json')

    assert (input_data[0] == data_1).all()
    assert (input_data[1] == data_3).all()
