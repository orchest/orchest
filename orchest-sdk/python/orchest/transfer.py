"""Transfer mechanisms to output data and get data."""
import json
import os
import pickle
import warnings
from collections import defaultdict
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

import pyarrow as pa

from orchest import error
from orchest.config import Config
from orchest.pipeline import Pipeline
from orchest.utils import get_step_uuid


class Serialization(Enum):
    """Possible types of serialization.

    Types are:

        * ``ARROW_TABLE``
        * ``ARROW_BATCH``
        * ``PICKLE``

    """

    ARROW_TABLE = 0
    ARROW_BATCH = 1
    PICKLE = 2


_MULTIPLE_DATA_TRANSFER_CALLS_WARNING_DOCS_REFERENCE = (
    "Refer to the docs at "
    "https://docs.orchest.io/en/latest/fundamentals/data_passing.html#data-passing "
    "for more info."
)

_MULTIPLE_DATA_TRANSFER_CALLS_HOW_TO_SILENCE = (
    "To silence all warnings related to calling data transfer functions multiple "
    "times, set orchest.Config.silence_multiple_data_transfer_calls_warning to True."
)

# Use an int because a name is Optional[str]. Indirectly acts as a
# variable to know if any output* function was called.
_last_output_name = -1
_OUTPUT_FUNCTIONS_CALLED_MULTIPLE_TIMES_WARNING = (
    (
        "WARNING: Outputting data multiple times will overwrite previously outputted "
        "data, regardless of the given `name`."
    )
    + " "
    + _MULTIPLE_DATA_TRANSFER_CALLS_WARNING_DOCS_REFERENCE
    + " "
    + _MULTIPLE_DATA_TRANSFER_CALLS_HOW_TO_SILENCE
)


def _warn_multiple_data_output_if_necessary(name: Optional[str]):
    global _last_output_name
    if (
        not Config.silence_multiple_data_transfer_calls_warning
        and _last_output_name != -1
        and _last_output_name != name
    ):
        _print_warning_message(_OUTPUT_FUNCTIONS_CALLED_MULTIPLE_TIMES_WARNING)
    _last_output_name = name


_get_inputs_called = False
_GET_INPUTS_CALLED_TWICE_WARNING = (
    (
        "WARNING: Calling `get_inputs` more than once is likely to cause issues when "
        "running your pipeline as a job. After the input data is retrieved it is "
        "slated for eviction, causing the data to no longer be available "
        "for subsequent calls to `get_inputs`."
    )
    + " "
    + _MULTIPLE_DATA_TRANSFER_CALLS_WARNING_DOCS_REFERENCE
    + " "
    + _MULTIPLE_DATA_TRANSFER_CALLS_HOW_TO_SILENCE
)


def _print_warning_message(msg: str, category=RuntimeWarning, stacklevel=2) -> None:
    # Print only the message, without line number, module etc. There
    # isn't a setting that makes this information meaningful in all
    # cases. For example, it will output information related to the
    # Orchest script running the notebook depending on the stacklevel.

    # Hold in a temporary variable to not alter any user setting.
    tmp = warnings.formatwarning
    warnings.formatwarning = lambda msg, *args, **kwargs: f"{msg}\n"
    warnings.warn(msg, category=category, stacklevel=stacklevel)
    warnings.formatwarning = tmp


def _check_data_name_validity(name: Optional[str]):
    if not isinstance(name, (str, type(None))):
        raise TypeError("Name should be of type string or `None`.")

    if name is None:
        return

    if name == Config._RESERVED_UNNAMED_OUTPUTS_STR:
        raise ValueError(
            f"'{Config._RESERVED_UNNAMED_OUTPUTS_STR}' is a reserved `name`."
        )

    if Config.__METADATA_SEPARATOR__ in name:
        raise ValueError(
            f"'{Config.__METADATA_SEPARATOR__}' cannot be part of the `name`."
        )


def _interpret_metadata(metadata: str) -> Tuple[str, str, str]:
    """Interpret and return Orchest SDK metadata.

    Args:
        metadata: A string that can be interpreted as Orchest SDK
            metadata. To be considered valid, it must contain the string
            ``Config.__METADATA__SEPARATOR`` in a way that splitting the
            string through the separator would result in 3 or 4 elements
            , in the case of 4 elements, only the last 3 elements are
            considered. Those three strings must be, in order: a valid
            string representing a datetime (utc, ISO format), the string
            representation of a member of the Serialization enum, any
            string.

    Raises:
        InvalidMetaDataError: If the input string is invalid.

    Returns:
        A tuple of 3 strings. The first is the timestamp of when the
        data related to the metadata was produced (utc, ISO format).
        The second string is the type of serialization used (See the
        Serialization enum). The third string is the name with which the
        data was output.
    """

    if Config.__METADATA_SEPARATOR__ not in metadata:
        raise error.InvalidMetaDataError(
            f"Metadata {metadata} is missing the required separator."
        )
    metadata = metadata.split(Config.__METADATA_SEPARATOR__)

    # Metadata that was stored in memory has 4 elements, first is
    # ignored because it's an internal flag.
    # Metadata that was stored on disk has 3 elements.
    if len(metadata) in [3, 4]:
        timestamp, serialization, name = metadata[-3:]

        # check timestamp for validity
        try:
            datetime.fromisoformat(timestamp)
        except ValueError:
            raise error.InvalidMetaDataError(
                f"Metadata {metadata} has an invalid timestamp ({timestamp})."
            )
        except AttributeError:
            # ``fromisoformat`` was added in Python3.7. For earlier
            # versions we will simply not check the timestamp for
            # validity. Since we know we are always writing ISO
            # formatted strings, this case only becomes an issue if the
            # user is manually writing the data passing.
            pass

        # check serialization for correctness
        if serialization not in [
            Serialization.ARROW_TABLE.name,
            Serialization.ARROW_BATCH.name,
            Serialization.PICKLE.name,
        ]:
            raise error.InvalidMetaDataError(
                f"Metadata {metadata} has an "
                f"invalid serialization ({serialization})."
            )

        return timestamp, serialization, name
    else:
        raise error.InvalidMetaDataError(
            f"Metadata {metadata} has an invalid number of elements."
        )


def _serialize(
    data: Any,
) -> Tuple[bytes, Serialization]:
    """Serializes an object to a ``pa.Buffer``.

    The way the object is serialized depends on the nature of the
    object: ``pa.RecordBatch`` and ``pa.Table`` are serialized using
    ``pyarrow`` functions. All other cases are serialized through the
    ``pickle`` library.

    Args:
        data: The object/data to be serialized.

    Returns:
        Tuple of the serialized data (in ``pa.Buffer`` format) and the
        :class:`Serialization` that was used.

    Raises:
        SerializationError: If the data could not be serialized.

    Note:
        ``pickle`` does not include the code of custom functions or
        classes, it only pickles their names. Following to the official
        `Python Docs
        <https://docs.python.org/3/library/pickle.html#what-can-be-pickled-and-unpickled>`_:
        "Thus the defining module must be importable in the unpickling
        environment, and the module must contain the named object,
        otherwise an exception will be raised."

    """
    if isinstance(data, (pa.RecordBatch, pa.Table)):
        # Use the intended pyarrow functionalities when possible.
        if isinstance(data, pa.Table):
            serialization = Serialization.ARROW_TABLE
        else:
            serialization = Serialization.ARROW_BATCH

        output_buffer = pa.BufferOutputStream()
        try:
            writer = pa.RecordBatchStreamWriter(output_buffer, data.schema)
            writer.write(data)
            writer.close()
        except pa.ArrowSerializationError:
            raise error.SerializationError(
                f"Could not serialize data of type {type(data)}."
            )

        serialized = output_buffer.getvalue()

    else:
        # All other cases use the pickle library.
        serialization = Serialization.PICKLE

        # Use the best protocol possible, for reference see:
        # https://docs.python.org/3/library/pickle.html#pickle-protocols
        try:
            serialized = pickle.dumps(data, pickle.DEFAULT_PROTOCOL)
        except pickle.PicklingError:
            raise error.SerializationError(
                f"Could not pickle data of type {type(data)}."
            )

        # NOTE: zero-copy view on the bytes.
        serialized = pa.py_buffer(serialized)

    return serialized, serialization


def _output_to_disk(
    obj: pa.Buffer, full_path: str, serialization: Serialization
) -> None:
    """Outputs a serialized object to disk to the specified path.

    Args:
        obj: Object to output to disk.
        full_path: Full path to save the data to.
        serialization: Serialization of the `obj`. For possible values
            see :class:`Serialization`.

    Raises:
        ValueError: If the specified serialization is not valid.
    """
    if isinstance(serialization, Serialization):
        with pa.OSFile(f"{full_path}.{serialization.name}", "wb") as f:
            f.write(obj)
    else:
        raise ValueError("Function not defined for specified 'serialization'")

    return


def output_to_disk(
    data: Any,
    name: Optional[str],
    serialization: Optional[Serialization] = None,
) -> None:
    """Outputs data to disk.

    Note:
        Calling :meth:`output_to_disk` multiple times within the same
        script will overwrite the output, even when using a different
        output ``name``. You therefore want to be only calling the
        function once.

    To manage outputing the data to disk, this function has a side
    effect:

    * Writes to a HEAD file alongside the actual data file. This file
      serves as a protocol that returns the timestamp of the latest
      write to disk via this function alongside the used serialization.

    Args:
        data: Data to output to disk.
        name: Name of the output data. As a string, it becomes the name
            of the data, when ``None``, the data is considered nameless.
            This affects the way the data can be later retrieved using
            :func:`get_inputs`.
        serialization: Serialization of the `data` in case it is already
            serialized. For possible values see :class:`Serialization`.

    Raises:
        DataInvalidNameError: The name of the output data is invalid,
            e.g because it is a reserved name (``"unnamed"``) or because
            it contains a reserved substring.
        PipelineDefinitionNotFoundError: If the pipeline definition file
            could not be found.
        StepUUIDResolveError: The step's UUID cannot be resolved and
            thus it cannot determine where to output data to.

    Example:
        >>> data = "Data I would like to use in my next step"
        >>> output_to_disk(data, name="my_data")
    """
    try:
        _check_data_name_validity(name)
    except (ValueError, TypeError) as e:
        raise error.DataInvalidNameError(e)

    _warn_multiple_data_output_if_necessary(name)

    if name is None:
        name = Config._RESERVED_UNNAMED_OUTPUTS_STR

    try:
        with open(Config.PIPELINE_DEFINITION_PATH, "r") as f:
            pipeline_definition = json.load(f)
    except FileNotFoundError:
        raise error.PipelineDefinitionNotFoundError(
            f"Could not open {Config.PIPELINE_DEFINITION_PATH}."
        )

    pipeline = Pipeline.from_json(pipeline_definition)

    try:
        step_uuid = get_step_uuid(pipeline)
    except error.StepUUIDResolveError:
        raise error.StepUUIDResolveError("Failed to determine where to output data to.")

    # In case the data is not already serialized, then we need to
    # serialize it.
    if serialization is None:
        data, serialization = _serialize(data)

    # Recursively create any directories if they do not already exists.
    step_data_dir = Config.get_step_data_dir(step_uuid)
    os.makedirs(step_data_dir, exist_ok=True)

    # The HEAD file serves to resolve the transfer method.
    head_file = os.path.join(step_data_dir, "HEAD")
    with open(head_file, "w") as f:
        metadata = [
            datetime.utcnow().isoformat(timespec="seconds"),
            serialization.name,
            name,
        ]
        metadata = Config.__METADATA_SEPARATOR__.join(metadata)
        f.write(metadata)

    # Full path to write the actual data to.
    full_path = os.path.join(step_data_dir, step_uuid)

    return _output_to_disk(data, full_path, serialization=serialization)


def _deserialize_output_disk(full_path: str, serialization: str) -> Any:
    """Gets data from disk.

    Raises:
        ValueError: If the serialization argument is unsupported.
    """
    file_path = f"{full_path}.{serialization}"
    if serialization == Serialization.ARROW_TABLE.name:
        # pa.memory_map is for reading (zero-copy)
        with pa.memory_map(file_path, "rb") as input_file:
            # read all batches as a table
            stream = pa.ipc.open_stream(input_file)
            return stream.read_all()
    elif serialization == Serialization.ARROW_BATCH.name:
        with pa.memory_map(file_path, "rb") as input_file:
            # return the first batch (the only one)
            stream = pa.ipc.open_stream(input_file)
            return [b for b in stream][0]
    elif serialization == Serialization.PICKLE.name:
        # https://docs.python.org/3/library/pickle.html
        # The argument file must have three methods:
        # * ``read()`` that takes an integer argument,
        # * ``readinto()`` that takes a buffer argument,
        # * ``readline()`` that requires no arguments, similar to the
        #   ``io.BufferedIOBase`` interface.

        # https://arrow.apache.org/docs/python/generated/pyarrow.MemoryMappedFile.html#pyarrow.MemoryMappedFile
        # While ``memory_map`` does not support readline, given the
        # docs, using ``pickle.load`` on a memory mapped file would
        # work, however, it was safer to not take the risk and use the
        # normal python file.
        with open(file_path, "rb") as input_file:
            return pickle.load(input_file)
    else:
        raise ValueError(
            f"The specified serialization of '{serialization}' is unsupported."
        )


def _get_output_disk(step_uuid: str, serialization: str) -> Any:
    """Gets data from disk.

    Args:
        step_uuid: The UUID of the step to get output data from.
        serialization: The serialization for the output. For possible
            values see :class:`Serialization`.

    Returns:
        Data from the step identified by `step_uuid`.

    Raises:
        DiskOutputNotFoundError: If output from `step_uuid` cannot be
            found.
        DeserializationError: If the data could not be deserialized.
    """
    step_data_dir = Config.get_step_data_dir(step_uuid)
    full_path = os.path.join(step_data_dir, step_uuid)

    try:
        return _deserialize_output_disk(full_path, serialization=serialization)
    except FileNotFoundError:
        # TODO: Ideally we want to provide the user with the step's
        #       name instead of UUID.
        raise error.DiskOutputNotFoundError(
            f'Output from incoming step "{step_uuid}" cannot be found. '
            "Try rerunning it."
        )
    # IOError is to try to catch pyarrow failures on opening the file.
    except (pickle.UnpicklingError, IOError):
        raise error.DeserializationError(
            f'Output from incoming step "{step_uuid}" ({full_path}) '
            "could not be deserialized."
        )


def _resolve_disk(step_uuid: str) -> Dict[str, Any]:
    """Returns information of the most recent write to disk.

    Resolves via the HEAD file the timestamp (that is used to determine
    the most recent write) and arguments to call the
    :meth:`get_output_disk` method.

    Args:
        step_uuid: The UUID of the step to resolve its most recent write
            to disk.

    Returns:
        Dictionary containing the information of the function to be
        called to get the most recent data from the step. Additionally,
        returns fill-in arguments for the function and metadata related
        to the data that would be retrieved.

    Raises:
        DiskOutputNotFoundError: If output from `step_uuid` cannot be
            found.
    """
    step_data_dir = Config.get_step_data_dir(step_uuid)
    head_file = os.path.join(step_data_dir, "HEAD")

    try:
        with open(head_file, "r") as f:
            timestamp, serialization, name = _interpret_metadata(f.read())

    except FileNotFoundError:
        # TODO: Ideally we want to provide the user with the step's
        #       name instead of UUID.
        raise error.DiskOutputNotFoundError(
            f'Output from incoming step "{step_uuid}" cannot be found. '
            "Try rerunning it."
        )

    res = {
        "method_to_call": _get_output_disk,
        "method_args": (step_uuid,),
        "method_kwargs": {"serialization": serialization},
        "metadata": {
            "timestamp": timestamp,
            "serialization": serialization,
            "name": name,
        },
    }
    return res


def output_to_memory(
    data: Any,
    name: Optional[str],
    disk_fallback: bool = True,
) -> None:
    """Outputs data to memory.

    Warning:
        Memory passing is not supported in this version of Orchest, this
        function will output to disk.

    Note:
        Calling :meth:`output_to_memory` multiple times within the same
        script will overwrite the output, even when using a different
        output ``name``. You therefore want to be only calling the
        function once.

    To manage outputing the data to memory for the user, this function
    uses metadata to add info to objects inside the plasma store.

    Args:
        data: Data to output.
        name: Name of the output data. As a string, it becomes the name
            of the data, when ``None``, the data is considered nameless.
            This affects the way the data can be later retrieved using
            :func:`get_inputs`.
        disk_fallback: If ``True``, then outputing to disk is used when
            the `data` does not fit in memory. If ``False``, then a
            :exc:`MemoryError` is thrown.

    Raises:
        DataInvalidNameError: The name of the output data is invalid,
            e.g because it is a reserved name (``"unnamed"``) or because
            it contains a reserved substring.
        MemoryError: If the `data` does not fit in memory and
            ``disk_fallback=False``.
        OrchestNetworkError: Could not connect to the
            ``Config.STORE_SOCKET_NAME``, because it does not exist.
            Which might be because the specified value was wrong or the
            store died.
        PipelineDefinitionNotFoundError: If the pipeline definition file
            could not be found.
        StepUUIDResolveError: The step's UUID cannot be resolved and
            thus it cannot set the correct ID to identify the data in
            the memory store.

    Example:
        >>> data = "Data I would like to use in my next step"
        >>> output_to_memory(data, name="my_data")
    """
    msg = (
        "Memory passing is not supported in this version of Orchest. This function "
        "will output to disk. No changes to your code are required."
    )
    _print_warning_message(msg)
    output(data, name)
    return


def _resolve(
    step_uuid: str, consumer: str = None
) -> Tuple[Callable, Sequence[Any], Dict[str, Any], Dict[str, Any]]:
    """Resolves the most recently used tranfer method of the given step.

    Additionally, resolves all the ``*args`` and ``**kwargs`` the
    receiving transfer method has to be called with.

    Args:
        step_uuid: UUID of the step to resolve its most recent write.
        consumer: The consumer of the output data. This is put inside
            the metadata of an empty object to trigger a notification in
            the plasma store, which is then used to manage eviction of
            objects.

    Returns:
        Tuple containing the information of the function to be called
        to get the most recent data from the step. Additionally, returns
        fill-in arguments for the function and metadata related to the
        data that would be retrieved.on.

    Raises:
        OutputNotFoundError: If no output can be found of the given
            `step_uuid`. Either no output was generated or the in-memory
            object store died (and therefore lost all its data).
    """
    # NOTE: All "resolve_{method}" functions have to be included in this
    # list. It is used to resolve what what "get_output_..." method to
    # invoke.
    resolve_methods: List[Callable] = [_resolve_disk]

    method_infos = []
    method_infos_exceptions = []
    for method in resolve_methods:
        try:
            if method.__name__ == "_resolve_memory":
                method_info = method(step_uuid, consumer=consumer)
            else:
                method_info = method(step_uuid)
        except (
            # Might happen in the case a user has metadata produced by a
            # version of the Orchest-SDK that is incompatible with this
            # one.
            error.InvalidMetaDataError,
            # We know now that the user did not use this method to
            # output thus we can just skip it and continue.
            error.OutputNotFoundError,
            # If no in-memory store is running, then getting the data
            # from memory obviously will not work.
            error.OrchestNetworkError,
        ) as e:
            method_infos_exceptions.append(str(e))
        else:
            method_infos.append(method_info)

    # If no info could be collected, then the previous step has not yet
    # been executed.
    if not method_infos:
        raise error.OutputNotFoundError(
            "Output could not be found in memory or on disk."
        )

    # Get the method that was most recently used based on its logged
    # timestamp.
    # NOTE: if multiple methods have the same timestamp then the method
    # that is highest in the `resolve_methods` list will be returned.
    # Since `max` returns the first occurrence of the maximum value.
    most_recent = max(method_infos, key=lambda x: x["metadata"]["timestamp"])
    return (
        most_recent["method_to_call"],
        most_recent["method_args"],
        most_recent["method_kwargs"],
        most_recent["metadata"],
    )


def get_inputs(
    ignore_failure: bool = False,
    verbose: bool = False,
) -> Dict[str, Any]:
    """Gets all data sent from incoming steps.

    Warning:
        Only call :meth:`get_inputs` once! When auto eviction is
        configured data might no longer be available. Either cache the
        data or maintain a copy yourself.

    Args:
        ignore_failure: If ``True`` then the returned result can have
            ``None`` values if the data of a step could not be
            retrieved. If ``False``, then this function will fail if any
            of the incoming steps's data could not be retrieved.
            Example: ``[None, "Hello World!"]`` vs
            :exc:`OutputNotFoundError`
        verbose: If ``True`` print all the steps from which the current
            step has retrieved data.

    Returns:
        Dictionary with input data for this step. We differentiate
        between two cases:

        * Named data, which is data that was outputted with a `name` by
          any parent step. Named data can be retrieved through the
          dictionary by its name, e.g.
          ``data = get_inputs()["my_name"]``.  Name collisions will
          raise an :exc:`InputNameCollisionError`.
        * Unnamed data, which is an ordered list containing all the
          data that was outputted without a name by the parent steps.
          Unnamed data can be retrieved by accessing the reserved
          ``"unnamed"`` key. The order of this list depends on the order
          of the parent steps of the node, which is visible through the
          GUI, refer to the :ref:`this section <unnamed order>` for more
          details.

        Example::

            # It does not matter how the data was outputted by parent
            # steps. It is resolved automatically by the `get_inputs`
            # method.
            {
                "unnamed" : ["Hello World!", (3, 4)],
                "named_1" : "mystring",
                "named_2" : [1, 2, 3]
            }

    Raises:
        InputNameCollisionError: Multiple steps have outputted data with
            the same name.
        OutputNotFoundError: If no output can be found of the given
            `step_uuid`. Either no output was generated or the in-memory
            object store died (and therefore lost all its data).
        StepUUIDResolveError: The step's UUID cannot be resolved and
            thus it cannot determine what inputs to get.
    """
    global _get_inputs_called
    if not Config.silence_multiple_data_transfer_calls_warning and _get_inputs_called:
        _print_warning_message(_GET_INPUTS_CALLED_TWICE_WARNING)
    _get_inputs_called = True

    try:
        with open(Config.PIPELINE_DEFINITION_PATH, "r") as f:
            pipeline_definition = json.load(f)
    except FileNotFoundError:
        raise error.PipelineDefinitionNotFoundError(
            f"Could not open {Config.PIPELINE_DEFINITION_PATH}."
        )

    pipeline = Pipeline.from_json(pipeline_definition)
    try:
        step_uuid = get_step_uuid(pipeline)
    except error.StepUUIDResolveError:
        raise error.StepUUIDResolveError("Failed to determine from where to get data.")

    collisions_dict = defaultdict(list)
    get_output_methods = []

    # Check for collisions before retrieving any data.
    for parent in pipeline.get_step_by_uuid(step_uuid).parents:

        # For each parent get what function to use to retrieve its
        # output data and metadata related to said data.
        parent_uuid = parent.properties["uuid"]

        try:
            get_output_method, args, kwargs, metadata = _resolve(
                parent_uuid, consumer=step_uuid
            )
        except error.OutputNotFoundError:
            parent_title = parent.properties["title"]
            msg = (
                f'Output from incoming step "{parent_title}" '
                f'("{parent_uuid}") cannot be found. Try rerunning it.'
            )
            raise error.OutputNotFoundError(msg)

        # Maintain the output methods in order, but wait with calling
        # them so that we can first check for collisions.
        get_output_methods.append((parent, get_output_method, args, kwargs, metadata))

        if metadata["name"] != Config._RESERVED_UNNAMED_OUTPUTS_STR:
            collisions_dict[metadata["name"]].append(parent.properties["title"])

    # If there are collisions raise an error.
    collisions_dict = {k: v for k, v in collisions_dict.items() if len(v) > 1}
    if collisions_dict:
        msg = "".join(
            [
                f"\n{name}: {sorted(step_names)}"
                for name, step_names in collisions_dict.items()
            ]
        )
        raise error.InputNameCollisionError(
            f"Name collisions between input data coming from different steps: {msg}"
        )

    # TODO: maybe instead of for loop we could first get the receive
    #       method and then do batch receive. For example memory allows
    #       to do get_buffers which operates in batch.
    # NOTE: the order in which the `parents` list is traversed is
    # indirectly set in the UI. The order is important since it
    # determines the order in which unnamed inputs are received in
    # the next step.
    data = {Config._RESERVED_UNNAMED_OUTPUTS_STR: []}  # type: Dict[str, Any]
    for parent, get_output_method, args, kwargs, metadata in get_output_methods:

        # Either raise an error on failure of getting output or
        # continue with other steps.
        try:
            incoming_step_data = get_output_method(*args, **kwargs)
        except error.OutputNotFoundError as e:
            if not ignore_failure:
                raise error.OutputNotFoundError(e)

            incoming_step_data = None

        if verbose:
            parent_title = parent.properties["title"]
            if incoming_step_data is None:
                print(f'Failed to retrieve input from step: "{parent_title}"')
            else:
                print(f'Retrieved input from step: "{parent_title}"')

        # Populate the return dictionary, where nameless data gets
        # appended to a list and named data becomes a (name, data) pair.
        name = metadata["name"]
        if name == Config._RESERVED_UNNAMED_OUTPUTS_STR:
            data[Config._RESERVED_UNNAMED_OUTPUTS_STR].append(incoming_step_data)
        else:
            data[name] = incoming_step_data

    return data


def output(
    data: Any,
    name: Optional[str],
) -> None:
    """Outputs data so that it can be retrieved by the next step.

    Note:
        Calling :meth:`output` multiple times within the same step
        will overwrite the output, even when using a different output
        ``name``. You therefore want to be only calling the function
        once.

    Args:
        data: Data to output.
        name: Name of the output data. As a string, it becomes the name
            of the data, when ``None``, the data is considered nameless.
            This affects the way the data can be later retrieved using
            :func:`get_inputs`.

    Raises:
        DataInvalidNameError: The name of the output data is invalid,
            e.g because it is a reserved name (``"unnamed"``) or because
            it contains a reserved substring.
        OrchestNetworkError: Could not connect to the
            ``Config.STORE_SOCKET_NAME``, because it does not exist.
            Which might be because the specified value was wrong or the
            store died.
        StepUUIDResolveError: The step's UUID cannot be resolved and
            thus data cannot be outputted.

    Example:
        >>> data = "Data I would like to use in my next step"
        >>> output(data, name="my_data")
    """
    try:
        _check_data_name_validity(name)
    except (ValueError, TypeError) as e:
        raise error.DataInvalidNameError(e)

    return output_to_disk(
        data,
        name,
    )


# TODO: Once we are set on the API we could specify __all__. For now we
#       will stick with the leading _underscore convention to indicate
#       private methods.
