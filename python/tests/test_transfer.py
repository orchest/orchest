"""
uuid-1, uuid-3 --> uuid-2
"""
from unittest.mock import patch

from orchest import transfer


@patch('orchest.transfer.get_step_uuid')
@patch('orchest.config.STEP_DATA_DIR', 'tests/userdir/.data/{step_uuid}')
def test_transfer_disk(mock_get_step_uuid):
    # Do as if we are uuid-1
    send_data_step_1 = [1, 2, 3]
    mock_get_step_uuid.return_value = 'uuid-1'
    transfer.send_disk(
        send_data_step_1,
        pipeline_description_path='tests/userdir/pipeline.json'
    )

    # Do as if we are uuid-3
    send_data_step_3 = [6, 5, 4]
    mock_get_step_uuid.return_value = 'uuid-3'
    transfer.send_disk(
        send_data_step_3,
        pipeline_description_path='tests/userdir/pipeline.json'
    )

    # Do as if we are uuid-2
    mock_get_step_uuid.return_value = 'uuid-2'
    received_data = transfer.receive('tests/userdir/pipeline.json')

    assert received_data == [send_data_step_1, send_data_step_3]
