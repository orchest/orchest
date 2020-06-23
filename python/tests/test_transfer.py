"""
uuid-1, uuid-3 --> uuid-2
"""
from unittest.mock import patch

import pyarrow.plasma as plasma
import pytest

import orchest
from orchest import transfer


@pytest.fixture()
def plasma_store(monkeypatch):
    with plasma.start_plasma_store(1000000000) as info:
        store_socket_name, _ = info
        monkeypatch.setattr(orchest.config, 'STORE_SOCKET_NAME', store_socket_name)
        yield store_socket_name


@patch('orchest.transfer.get_step_uuid')
@patch('orchest.config.STEP_DATA_DIR', 'tests/userdir/.data/{step_uuid}')
def test_transfer_disk(mock_get_step_uuid):
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


# TODO:
# fallback disk
# pickle fallback for serialization
