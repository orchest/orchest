"""
uuid-1, uuid-3 --> uuid-2
"""
import time
from unittest.mock import patch

import numpy as np
import pandas as pd
import pyarrow as pa
import pytest

import orchest
from orchest import transfer

KILOBYTE = 1 << 10
MEGABYTE = KILOBYTE * KILOBYTE

# NOTE: has to be multiple of 10, ie. 10, 100, etc.
PLASMA_KILOBYTES = 10
PLASMA_STORE_CAPACITY = PLASMA_KILOBYTES * KILOBYTE


def generate_data(total_size):
    nrows = int(total_size / np.dtype("float64").itemsize)
    return np.random.randn(nrows)


def generate_pandas_df(n_rows):
    # divide to make it in seconds
    start = pd.to_datetime("2000-01-01").value // 10**9
    end = pd.to_datetime("2021-01-01").value // 10**9
    df = pd.DataFrame(
        {
            "C1": np.random.randint(-10000, 100000, size=n_rows),
            "C2": np.random.randn(n_rows),
            "C4": pd.to_datetime(np.random.randint(start, end, size=n_rows), unit="s"),
            "C5": pd.to_datetime(np.random.randint(start, end, size=n_rows), unit="ms"),
            "C6": pd.to_datetime(np.random.randint(start, end, size=n_rows), unit="us"),
            "C7": pd.to_datetime(np.random.randint(start, end, size=n_rows), unit="ns"),
            "C8": [str(i) for i in range(n_rows)],
            "C9": [bytes(i) for i in range(n_rows)],
            "C10": [{i: i} for i in range(n_rows)],
            "C11": [None for _ in range(n_rows)],
        }
    )
    # set random values to nan
    df = df.mask(np.random.random(df.shape) < 0.5)
    return df


def get_test_record_batch():
    test_record_batch = [
        pa.array([1, 2, 3, 4]),
        pa.array(["foo", "bar", "baz", None]),
        pa.array([True, None, False, True]),
    ]
    test_record_batch = pa.record_batch(test_record_batch, names=["f0", "f1", "f2"])
    return test_record_batch


def get_test_table():
    return pa.Table.from_batches([get_test_record_batch()])


class CustomClass:
    def __init__(self, x):
        self.x = x

    def __eq__(self, other):
        if isinstance(self.x, np.ndarray) and isinstance(other.x, np.ndarray):
            return (self.x == other.x).all()

        return self.x == other.x


@pytest.mark.parametrize(
    "data_1",
    [
        generate_data(KILOBYTE),
        np.random.rand(10, 5, 2),
        np.array([CustomClass(1) for _ in range(3)]),
        generate_pandas_df(20),
        get_test_record_batch(),
        get_test_table(),
    ],
    ids=["basic", "ndarray", "ndarray-objects", "pandas", "record_batch", "table"],
)
@pytest.mark.parametrize(
    "test_transfer",
    [
        {"method": transfer.output_to_disk, "kwargs": {"name": None}},
        {"method": transfer.output_to_disk, "kwargs": {"name": "myname"}},
    ],
    ids=["unnammed", "named"],
)
@patch("orchest.transfer.get_step_uuid")
@patch("orchest.Config.STEP_DATA_DIR", "tests/userdir/.data/{step_uuid}")
def test_disk(mock_get_step_uuid, data_1, test_transfer, plasma_store):
    orchest.Config.PIPELINE_DEFINITION_PATH = "tests/userdir/pipeline-basic.json"

    # Do as if we are uuid-1. Note the trailing underscores. This is to
    # make the plasma.ObjectID the required 20 characters.
    mock_get_step_uuid.return_value = "uuid-1______________"

    test_transfer["method"](data_1, **test_transfer["kwargs"])

    # Do as if we are uuid-2
    mock_get_step_uuid.return_value = "uuid-2______________"
    input_data = transfer.get_inputs()

    assert isinstance(input_data, dict)
    name = test_transfer["kwargs"]["name"]
    if name is None:
        input_data = input_data[orchest.Config._RESERVED_UNNAMED_OUTPUTS_STR]
        assert len(input_data) == 1
        input_data = input_data[0]
    else:
        input_data = input_data[name]

    if isinstance(data_1, (pa.RecordBatch, pa.Table, pd.DataFrame)):
        assert input_data.equals(data_1)
    else:
        assert (input_data == data_1).all()


# TODO: add tests for other kwargs
@pytest.mark.parametrize(
    "data_1",
    [
        generate_data(KILOBYTE),
        np.random.rand(10, 5, 2),
        np.array([CustomClass(1) for _ in range(3)]),
        generate_pandas_df(20),
        get_test_record_batch(),
        get_test_table(),
    ],
    ids=["basic", "ndarray", "ndarray-objects", "pandas", "record_batch", "table"],
)
@pytest.mark.parametrize(
    "test_transfer",
    [
        {
            "method": transfer.output_to_memory,
            "kwargs": {
                "name": None,
                "disk_fallback": False,
            },
        },
        {
            "method": transfer.output_to_memory,
            "kwargs": {
                "name": "myname",
                "disk_fallback": False,
            },
        },
    ],
    ids=["disk_fallback=False;unnamed", "disk_fallback=False;named"],
)
@patch("orchest.transfer.get_step_uuid")
@patch("orchest.Config.STEP_DATA_DIR", "tests/userdir/.data/{step_uuid}")
def test_memory(mock_get_step_uuid, data_1, test_transfer, plasma_store):
    orchest.Config.PIPELINE_DEFINITION_PATH = "tests/userdir/pipeline-basic.json"

    # Do as if we are uuid-1. Note the trailing underscores. This is to
    # make the plasma.ObjectID the required 20 characters.
    mock_get_step_uuid.return_value = "uuid-1______________"
    test_transfer["method"](data_1, **test_transfer["kwargs"])

    # Do as if we are uuid-2
    mock_get_step_uuid.return_value = "uuid-2______________"
    input_data = transfer.get_inputs()

    assert isinstance(input_data, dict)
    name = test_transfer["kwargs"]["name"]
    if name is None:
        input_data = input_data[orchest.Config._RESERVED_UNNAMED_OUTPUTS_STR]
        assert len(input_data) == 1
        input_data = input_data[0]
    else:
        input_data = input_data[name]

    if isinstance(data_1, (pa.RecordBatch, pa.Table, pd.DataFrame)):
        assert input_data.equals(data_1)
    else:
        assert (input_data == data_1).all()


@patch("orchest.transfer.get_step_uuid")
@patch("orchest.Config.STEP_DATA_DIR", "tests/userdir/.data/{step_uuid}")
def test_memory_out_of_memory(mock_get_step_uuid, plasma_store):
    data_1 = generate_data((PLASMA_KILOBYTES + 1) * KILOBYTE)
    ser_data, _ = transfer._serialize(data_1)
    data_size = ser_data.size
    assert data_size > PLASMA_STORE_CAPACITY

    orchest.Config.PIPELINE_DEFINITION_PATH = "tests/userdir/pipeline-basic.json"

    # Do as if we are uuid-1
    mock_get_step_uuid.return_value = "uuid-1______________"

    with pytest.raises(MemoryError):
        transfer.output_to_memory(
            data_1,
            name=None,
            disk_fallback=False,
        )


@patch("orchest.transfer.get_step_uuid")
@patch("orchest.Config.STEP_DATA_DIR", "tests/userdir/.data/{step_uuid}")
def test_memory_disk_fallback(mock_get_step_uuid, plasma_store):
    orchest.Config.PIPELINE_DEFINITION_PATH = "tests/userdir/pipeline-basic.json"

    # Do as if we are uuid-1
    data_1 = generate_data((PLASMA_KILOBYTES + 1) * KILOBYTE)
    ser_data, _ = transfer._serialize(data_1)
    data_size = ser_data.size
    assert data_size > PLASMA_STORE_CAPACITY

    mock_get_step_uuid.return_value = "uuid-1______________"
    transfer.output_to_memory(
        data_1,
        name=None,
        disk_fallback=True,
    )

    # Do as if we are uuid-2
    mock_get_step_uuid.return_value = "uuid-2______________"
    input_data = transfer.get_inputs()
    input_data = input_data[orchest.Config._RESERVED_UNNAMED_OUTPUTS_STR][0]
    assert (input_data == data_1).all()


@patch("orchest.transfer.get_step_uuid")
@patch("orchest.Config.STEP_DATA_DIR", "tests/userdir/.data/{step_uuid}")
def test_memory_pickle_fallback_and_disk_fallback(mock_get_step_uuid, plasma_store):
    data_1 = [CustomClass(generate_data(KILOBYTE)) for _ in range(PLASMA_KILOBYTES + 1)]
    serialized, _ = transfer._serialize(data_1)
    assert serialized.size > PLASMA_STORE_CAPACITY

    orchest.Config.PIPELINE_DEFINITION_PATH = "tests/userdir/pipeline-basic.json"

    # Do as if we are uuid-1
    mock_get_step_uuid.return_value = "uuid-1______________"
    transfer.output_to_memory(
        data_1,
        name=None,
        disk_fallback=True,
    )

    # Do as if we are uuid-2
    mock_get_step_uuid.return_value = "uuid-2______________"
    input_data = transfer.get_inputs()
    input_data = input_data[orchest.Config._RESERVED_UNNAMED_OUTPUTS_STR][0]
    assert input_data == data_1


@patch("orchest.transfer.get_step_uuid")
@patch("orchest.Config.STEP_DATA_DIR", "tests/userdir/.data/{step_uuid}")
def test_resolve_disk_then_memory(mock_get_step_uuid, plasma_store):
    orchest.Config.PIPELINE_DEFINITION_PATH = "tests/userdir/pipeline-basic.json"

    # Do as if we are uuid-1.
    mock_get_step_uuid.return_value = "uuid-1______________"

    data_1 = generate_data(KILOBYTE)
    transfer.output_to_disk(data_1, name=None)

    # It is very unlikely you will output through memory and disk in
    # quick succession. In addition, the resolve order has a precision
    # of seconds.  Thus we need to ensure that indeed it can be
    # resolved.
    time.sleep(1)

    data_1_new = generate_data(KILOBYTE)
    transfer.output_to_memory(
        data_1_new,
        name=None,
        disk_fallback=False,
    )

    # Do as if we are uuid-2
    mock_get_step_uuid.return_value = "uuid-2______________"
    input_data = transfer.get_inputs()
    input_data = input_data[orchest.Config._RESERVED_UNNAMED_OUTPUTS_STR][0]
    assert (input_data == data_1_new).all()


@patch("orchest.transfer.get_step_uuid")
@patch("orchest.Config.STEP_DATA_DIR", "tests/userdir/.data/{step_uuid}")
def test_resolve_memory_then_disk(mock_get_step_uuid, plasma_store):
    orchest.Config.PIPELINE_DEFINITION_PATH = "tests/userdir/pipeline-basic.json"

    # Do as if we are uuid-1.
    mock_get_step_uuid.return_value = "uuid-1______________"

    data_1 = generate_data(KILOBYTE)
    transfer.output_to_memory(
        data_1,
        name=None,
        disk_fallback=False,
    )

    # It is very unlikely you will output through memory and disk in
    # quick succession. In addition, the resolve order has a precision
    # of seconds. Thus we need to ensure that indeed it can be resolved.
    time.sleep(1)

    data_1_new = generate_data(KILOBYTE)
    transfer.output_to_disk(data_1_new, name=None)

    # Do as if we are uuid-2
    mock_get_step_uuid.return_value = "uuid-2______________"
    input_data = transfer.get_inputs()
    input_data = input_data[orchest.Config._RESERVED_UNNAMED_OUTPUTS_STR][0]
    assert (input_data == data_1_new).all()


@patch("orchest.transfer.get_step_uuid")
@patch("orchest.Config.STEP_DATA_DIR", "tests/userdir/.data/{step_uuid}")
def test_receive_input_order(mock_get_step_uuid, plasma_store):
    """Test the order of the inputs of the receiving step.

    Note that the order in which the data is output does not determine
    the "receive order", it is the order in which it is defined in the
    pipeline.json (for the "incoming-connections").
    """
    orchest.Config.PIPELINE_DEFINITION_PATH = "tests/userdir/pipeline-order.json"

    # Do as if we are uuid-3
    data_3 = generate_data(KILOBYTE)
    mock_get_step_uuid.return_value = "uuid-3______________"
    transfer.output_to_memory(data_3, name=None)

    # Do as if we are uuid-1
    data_1 = generate_data(KILOBYTE)
    mock_get_step_uuid.return_value = "uuid-1______________"
    transfer.output_to_memory(data_1, name=None)

    # Do as if we are uuid-2
    mock_get_step_uuid.return_value = "uuid-2______________"
    input_data = transfer.get_inputs()
    input_data = input_data[orchest.Config._RESERVED_UNNAMED_OUTPUTS_STR]
    assert (input_data[0] == data_1).all()
    assert (input_data[1] == data_3).all()


@patch("orchest.transfer.get_step_uuid")
@patch("orchest.Config.STEP_DATA_DIR", "tests/userdir/.data/{step_uuid}")
def test_receive_multiple_named_inputs(mock_get_step_uuid, plasma_store):
    """Test receiving multiple named inputs."""
    orchest.Config.PIPELINE_DEFINITION_PATH = "tests/userdir/pipeline-order.json"

    # Do as if we are uuid-3
    data_3 = generate_data(KILOBYTE)
    mock_get_step_uuid.return_value = "uuid-3______________"
    transfer.output_to_memory(data_3, name="output3")

    # Do as if we are uuid-1
    data_1 = generate_data(KILOBYTE)
    mock_get_step_uuid.return_value = "uuid-1______________"
    transfer.output_to_memory(data_1, name="output1")

    # Do as if we are uuid-2
    mock_get_step_uuid.return_value = "uuid-2______________"
    input_data = transfer.get_inputs()
    assert len(input_data) == 3
    assert not input_data[orchest.Config._RESERVED_UNNAMED_OUTPUTS_STR]
    assert (input_data["output1"] == data_1).all()
    assert (input_data["output3"] == data_3).all()


@patch("orchest.transfer.get_step_uuid")
@patch("orchest.Config.STEP_DATA_DIR", "tests/userdir/.data/{step_uuid}")
def test_output_no_memory_store(mock_get_step_uuid):
    """Test the order of the inputs of the receiving step.

    Note that the order in which the data is output does not determine
    the "receive order", it is the order in which it is defined in the
    pipeline.json (for the "incoming-connections").
    """
    orchest.Config.PIPELINE_DEFINITION_PATH = "tests/userdir/pipeline-basic.json"

    # Do as if we are uuid-1
    data_1 = generate_data(KILOBYTE)
    mock_get_step_uuid.return_value = "uuid-1______________"
    transfer.output(data_1, name=None)

    # Do as if we are uuid-2
    mock_get_step_uuid.return_value = "uuid-2______________"
    input_data = transfer.get_inputs()

    input_data = transfer.get_inputs()
    input_data = input_data[orchest.Config._RESERVED_UNNAMED_OUTPUTS_STR][0]
    assert (input_data == data_1).all()
