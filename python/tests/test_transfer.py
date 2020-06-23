"""
uuid-1, uuid-3 --> uuid-2
"""
import time
from unittest.mock import patch

import numpy as np
import pyarrow as pa
import pyarrow.plasma as plasma
import pytest

import orchest
from orchest import transfer


PLASMA_STORE_CAPACITY = 10000000


@pytest.fixture()
def plasma_store(monkeypatch):
    with plasma.start_plasma_store(PLASMA_STORE_CAPACITY) as info:
        store_socket_name, _ = info
        monkeypatch.setattr(orchest.Config, 'STORE_SOCKET_NAME', store_socket_name)
        yield store_socket_name


@patch('orchest.transfer.get_step_uuid')
@patch('orchest.Config.STEP_DATA_DIR', 'tests/userdir/.data/{step_uuid}')
def test_transfer_disk(mock_get_step_uuid, plasma_store):
    # Do as if we are uuid-1
    send_data_step_1 = [1, 2, 3]
    mock_get_step_uuid.return_value = 'uuid-1______________'
    transfer.send_disk(
        send_data_step_1,
        pipeline_description_path='tests/userdir/pipeline.json'
    )

    # Do as if we are uuid-3
    send_data_step_3 = [6, 5, 4]
    mock_get_step_uuid.return_value = 'uuid-3______________'
    transfer.send_disk(
        send_data_step_3,
        pipeline_description_path='tests/userdir/pipeline.json'
    )

    # Do as if we are uuid-2
    mock_get_step_uuid.return_value = 'uuid-2______________'
    received_data = transfer.receive('tests/userdir/pipeline.json')

    assert received_data == [send_data_step_1, send_data_step_3]


@patch('orchest.transfer.get_step_uuid')
@patch('orchest.Config.STEP_DATA_DIR', 'tests/userdir/.data/{step_uuid}')
def test_transfer_memory(mock_get_step_uuid, plasma_store):
    # Do as if we are uuid-1
    send_data_step_1 = [1, 2, 3]
    mock_get_step_uuid.return_value = 'uuid-1______________'
    transfer.send_memory(
        send_data_step_1,
        disk_fallback=False,
        store_socket_name=plasma_store,
        pipeline_description_path='tests/userdir/pipeline.json'
    )

    # Do as if we are uuid-3
    send_data_step_3 = [6, 5, 4]
    mock_get_step_uuid.return_value = 'uuid-3______________'
    transfer.send_memory(
        send_data_step_3,
        disk_fallback=False,
        store_socket_name=plasma_store,
        pipeline_description_path='tests/userdir/pipeline.json'
    )

    # Do as if we are uuid-2
    mock_get_step_uuid.return_value = 'uuid-2______________'
    received_data = transfer.receive('tests/userdir/pipeline.json')

    assert received_data == [send_data_step_1, send_data_step_3]


@patch('orchest.transfer.get_step_uuid')
@patch('orchest.Config.STEP_DATA_DIR', 'tests/userdir/.data/{step_uuid}')
def test_most_recently_used(mock_get_step_uuid, plasma_store):
    # Do as if we are uuid-1.
    # First write data via memory and then via disk.
    mock_get_step_uuid.return_value = 'uuid-1______________'

    send_data_step_1 = [10, 20, 30]
    transfer.send_memory(
        send_data_step_1,
        disk_fallback=False,
        store_socket_name=plasma_store,
        pipeline_description_path='tests/userdir/pipeline.json'
    )

    # TODO: without the sleep the resolve does not work, because disk
    #       outputs the timestamp with higher precision than memory.
    #       E.g: '2020-06-23T09:23:22.575459' vs '2020-06-23T09:23:22'
    # It is very unlikely you will send through memory and disk in quick
    # succession.
    time.sleep(1)

    send_data_step_1_new = [10, 10, 10]
    transfer.send_disk(
        send_data_step_1_new,
        pipeline_description_path='tests/userdir/pipeline.json'
    )

    # Do as if we are uuid-3
    mock_get_step_uuid.return_value = 'uuid-3______________'

    send_data_step_3 = [60, 50, 40]
    transfer.send_disk(
        send_data_step_3,
        pipeline_description_path='tests/userdir/pipeline.json'
    )

    # It is very unlikely you will send through memory and disk in quick
    # succession.
    time.sleep(1)

    send_data_step_3_new = [50, 50, 50]
    transfer.send_memory(
        send_data_step_3_new,
        disk_fallback=False,
        store_socket_name=plasma_store,
        pipeline_description_path='tests/userdir/pipeline.json'
    )

    # Do as if we are uuid-2
    mock_get_step_uuid.return_value = 'uuid-2______________'
    received_data = transfer.receive('tests/userdir/pipeline.json')

    assert received_data == [send_data_step_1_new, send_data_step_3_new]


class Foo:
    def __init__(self, x):
        self.x = x

    def __eq__(self, other):
        return self.x == other.x


@patch('orchest.transfer.get_step_uuid')
@patch('orchest.Config.STEP_DATA_DIR', 'tests/userdir/.data/{step_uuid}')
def test_memory_pickle_fallback(mock_get_step_uuid, plasma_store):
    # Do as if we are uuid-1
    send_data_step_1 = [Foo(1), Foo(2), Foo(3)]
    mock_get_step_uuid.return_value = 'uuid-1______________'
    transfer.send_memory(
        send_data_step_1,
        disk_fallback=False,
        store_socket_name=plasma_store,
        pipeline_description_path='tests/userdir/pipeline.json'
    )

    # Do as if we are uuid-3
    send_data_step_3 = [61, 51, 41]
    mock_get_step_uuid.return_value = 'uuid-3______________'
    transfer.send_memory(
        send_data_step_3,
        disk_fallback=False,
        store_socket_name=plasma_store,
        pipeline_description_path='tests/userdir/pipeline.json'
    )

    # Do as if we are uuid-2
    mock_get_step_uuid.return_value = 'uuid-2______________'
    received_data = transfer.receive('tests/userdir/pipeline.json')

    assert received_data == [send_data_step_1, send_data_step_3]


@patch('orchest.transfer.get_step_uuid')
@patch('orchest.Config.STEP_DATA_DIR', 'tests/userdir/.data/{step_uuid}')
def test_memory_disk_fallback(mock_get_step_uuid, plasma_store):
    # Do as if we are uuid-1
    send_data_step_1 = np.random.rand(150, 10000)
    data_size = pa.serialize(send_data_step_1).total_bytes
    assert data_size > PLASMA_STORE_CAPACITY

    mock_get_step_uuid.return_value = 'uuid-1______________'
    transfer.send_memory(
        send_data_step_1,
        disk_fallback=True,
        store_socket_name=plasma_store,
        pipeline_description_path='tests/userdir/pipeline.json'
    )

    # Do as if we are uuid-3
    send_data_step_3 = [62, 52, 42]
    mock_get_step_uuid.return_value = 'uuid-3______________'
    transfer.send_memory(
        send_data_step_3,
        disk_fallback=False,
        store_socket_name=plasma_store,
        pipeline_description_path='tests/userdir/pipeline.json'
    )

    # Do as if we are uuid-2
    mock_get_step_uuid.return_value = 'uuid-2______________'
    received_data = transfer.receive('tests/userdir/pipeline.json')

    assert (received_data[0] == send_data_step_1).all()
    assert received_data[1] == send_data_step_3
