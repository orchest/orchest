"""Transfer mechanisms to output data and get data."""
import json
import os
import pickle
from collections import defaultdict
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

import pyarrow as pa
import pyarrow.plasma as plasma

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


class _PlasmaConnector:
    """Manages the connection to the plasma in-memory store.

    Allows for only one connection to make sure the different methods
    don't all try to connect to the store individually.

    """

    _client: plasma.PlasmaClient = None

    @property
    def client(self):
        """Connects to the plasma store if not already connected.

        Returns:
            A plasma slient.

        Raises:
            MemoryOutputNotFoundError: If output from `step_uuid` cannot
                be found.
            OrchestNetworkError: Could not connect to the
                ``Config.STORE_SOCKET_NAME``, because it does not exist.
                Which might be because the specified value was wrong or
                the store died.
        """
        if self._client is not None:
            return self._client

        try:
            self._client = plasma.connect(
                Config.STORE_SOCKET_NAME, num_retries=Config.CONN_NUM_RETRIES
            )
        except OSError:
            raise error.OrchestNetworkError(
                "Failed to connect to in-memory object store."
            )

        return self._client


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
            serialized = pickle.dumps(data, pickle.HIGHEST_PROTOCOL)
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
    data: Any, name: Optional[str], serialization: Optional[Serialization] = None
) -> None:
    """Outputs data to disk.

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

    Note:
        Calling :meth:`output_to_disk` multiple times within the same
        script will overwrite the output, even when using a different
        output ``name``. You therefore want to be only calling the
        function once.

    """
    try:
        _check_data_name_validity(name)
    except (ValueError, TypeError) as e:
        raise error.DataInvalidNameError(e)

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


def _output_to_memory(
    obj: pa.Buffer,
    client: plasma.PlasmaClient,
    obj_id: Optional[plasma.ObjectID] = None,
    metadata: Optional[bytes] = None,
    memcopy_threads: int = 6,
) -> plasma.ObjectID:
    """Outputs an object to memory.

    Args:
        obj: Object to output to memory.
        client: A PlasmaClient to interface with the in-memory object
            store.
        obj_id: The ID to assign to the `obj` inside the plasma store.
            If ``None`` then one is randomly generated.
        metadata: Metadata to add to the `obj` inside the store.
        memcopy_threads: The number of threads to use to write the
            `obj` into the object store for large objects.

    Returns:
        The ID of the object inside the store. Either the given `obj_id`
        or a randomly generated one.

    Raises:
        MemoryError: If the `obj` does not fit in memory.
    """
    # Check whether the object to be passed in memory actually fits in
    # memory. We check explicitely instead of trying to insert it,
    # because inserting an already full Plasma store will start evicting
    # objects to free up space. However, we want to maintain control
    # over what objects get evicted.
    # obj.size -> "The buffer size in bytes."
    total_size = obj.size
    if metadata is not None:
        total_size += len(metadata)

    occupied_size = sum(
        obj["data_size"] + obj["metadata_size"] for obj in client.list().values()
    )
    # Take a percentage of the maximum capacity such that the message
    # for object eviction always fits inside the store.
    store_capacity = Config.MAX_RELATIVE_STORE_CAPACITY * client.store_capacity()
    available_size = store_capacity - occupied_size

    if total_size > available_size:
        raise MemoryError("Object does not fit in memory")

    # In case no `obj_id` is specified, one has to be generated because
    # an ID is required for an object to be inserted in the store.
    if obj_id is None:
        obj_id = plasma.ObjectID.from_random()

    # Write the object to the plasma store. If the obj_id already
    # exists, then it first has to be deleted. Essentially we are
    # overwriting the data (just like we do for disk)
    try:
        buffer = client.create(obj_id, obj.size, metadata=metadata)
    except plasma.PlasmaObjectExists:
        client.delete([obj_id])
        buffer = client.create(obj_id, obj.size, metadata=metadata)

    stream = pa.FixedSizeBufferWriter(buffer)
    stream.set_memcopy_threads(memcopy_threads)

    stream.write(obj)
    client.seal(obj_id)

    return obj_id


def output_to_memory(
    data: Any, name: Optional[str], disk_fallback: bool = True
) -> None:
    """Outputs data to memory.

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

    Note:
        Calling :meth:`output_to_memory` multiple times within the same
        script will overwrite the output, even when using a different
        output ``name``. You therefore want to be only calling the
        function once.

    """
    try:
        _check_data_name_validity(name)
    except (ValueError, TypeError) as e:
        raise error.DataInvalidNameError(e)

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

    # Serialize the object and collect the serialization metadata.
    obj, serialization = _serialize(data)

    try:
        client = _PlasmaConnector().client
    except error.OrchestNetworkError as e:
        if not disk_fallback:
            raise error.OrchestNetworkError(e)

        return output_to_disk(obj, name, serialization=serialization)

    # Try to output to memory.
    obj_id = _convert_uuid_to_object_id(step_uuid)
    metadata = [
        str(Config.IDENTIFIER_SERIALIZATION),
        # The plasma store allows to get the creation timestamp, but
        # creating it this way makes the process more consistent with
        # the metadata we are writing when outputting to disk, moreover,
        # it makes the code less dependent on the plasma store API.
        datetime.utcnow().isoformat(timespec="seconds"),
        serialization.name,
        # Can't simply assign to name beforehand because name might be
        # passed to output_to_disk, which needs to check for name
        # validity itself since its a public function.
        name if name is not None else Config._RESERVED_UNNAMED_OUTPUTS_STR,
    ]
    metadata = bytes(Config.__METADATA_SEPARATOR__.join(metadata), "utf-8")

    try:
        obj_id = _output_to_memory(obj, client, obj_id=obj_id, metadata=metadata)

    except MemoryError:
        if not disk_fallback:
            raise MemoryError("Data does not fit in memory.")

        # TODO: note that metadata is lost when falling back to disk.
        #       Therefore we will only support metadata added by the
        #       user, once disk also supports passing metadata.
        return output_to_disk(obj, name, serialization=serialization)

    return


def _deserialize_output_memory(
    obj_id: plasma.ObjectID, client: plasma.PlasmaClient
) -> Any:
    """Gets data from memory.

    Args:
        obj_id: The ID of the object to retrieve from the plasma store.
        client: A PlasmaClient to interface with the in-memory object
            store.

    Returns:
        The unserialized data from the store corresponding to the
        `obj_id`.

    Raises:
        ObjectNotFoundError: If the specified `obj_id` is not in the
            store.
        ValueError: If the serialization type in the metadata is not
            valid.
    """
    obj_ids = [obj_id]

    # TODO: the get_buffers allows for batch, which we want to use in
    #       the future.
    buffers = client.get_buffers(obj_ids, with_meta=True, timeout_ms=1000)

    # Since we currently know that we are only restrieving one buffer,
    # we can instantly get its metadata and buffer.
    metadata, buffer = buffers[0]

    # Getting the buffer timed out. We conclude that the object has not
    # yet been written to the store and maybe never will.
    if metadata is None and buffer is None:
        raise error.ObjectNotFoundError(
            f'Object with ObjectID "{obj_id}" does not exist in store.'
        )

    metadata = metadata.decode("utf-8").split(Config.__METADATA_SEPARATOR__)
    _, _, serialization, _ = metadata
    if serialization == Serialization.ARROW_TABLE.name:
        # Read all batches as a table.
        stream = pa.ipc.open_stream(buffer)
        return stream.read_all()

    elif serialization == Serialization.ARROW_BATCH.name:
        # Return the first batch (the only one).
        stream = pa.ipc.open_stream(buffer)
        return [b for b in stream][0]

    elif serialization == Serialization.PICKLE.name:
        # Can load the buffer directly because its a bytes-like-object:
        # https://docs.python.org/3/library/pickle.html#pickle.loads
        return pickle.loads(buffer)
    else:
        raise ValueError("Object was serialized with an unsupported serialization")


def _get_output_memory(step_uuid: str, consumer: Optional[str] = None) -> Any:
    """Gets data from memory.

    Args:
        step_uuid: The UUID of the step to get output data from.
        consumer: The consumer of the output data. This is put inside
            the metadata of an empty object to trigger a notification in
            the plasma store, which is then used to manage eviction of
            objects.

    Returns:
        Data from step identified by `step_uuid`.

    Raises:
        DeserializationError: If the data could not be deserialized.
        MemoryOutputNotFoundError: If output from `step_uuid` cannot be
            found.
        OrchestNetworkError: Could not connect to the
            ``Config.STORE_SOCKET_NAME``, because it does not exist.
            Which might be because the specified value was wrong or the
            store died.
    """
    client = _PlasmaConnector().client

    obj_id = _convert_uuid_to_object_id(step_uuid)
    try:
        obj = _deserialize_output_memory(obj_id, client)

    except error.ObjectNotFoundError:
        raise error.MemoryOutputNotFoundError(
            f'Output from incoming step "{step_uuid}" cannot be found. '
            "Try rerunning it."
        )
    # IOError is to try to catch pyarrow deserialization errors.
    except (pickle.UnpicklingError, IOError):
        raise error.DeserializationError(
            f'Output from incoming step "{step_uuid}" could not be deserialized.'
        )
    else:
        # TODO: note somewhere (maybe in the docstring) that it might
        #       although very unlikely raise MemoryError, because the
        #       receive is now actually also outputing data.
        # NOTE: the "ORCHEST_MEMORY_EVICTION" ENV variable is set in the
        # orchest-api. Now we always know when we are running inside a
        # jupyter kernel interactively. And in that case we never want
        # to do eviction.
        if os.getenv("ORCHEST_MEMORY_EVICTION") is not None:
            empty_obj, _ = _serialize("")
            msg = f"{Config.IDENTIFIER_EVICTION};{step_uuid},{consumer}"
            metadata = bytes(msg, "utf-8")
            _output_to_memory(empty_obj, client, metadata=metadata)

    return obj


def _resolve_memory(step_uuid: str, consumer: str = None) -> Dict[str, Any]:
    """Returns information of the most recent write to memory.

    Resolves the timestamp via the `create_time` attribute from the info
    of the plasma store. It also sets the arguments to call the
    :func:`get_output_memory` method with.

    Args:
        step_uuid: The UUID of the step to resolve its most recent write
            to memory.
        consumer: The consumer of the output data. This is put inside
            the metadata of an empty object to trigger a notification in
            the plasma store, which is then used to manage eviction of
            objects.

    Returns:
        Dictionary containing the information of the function to be
        called to get the most recent data from the step. Additionally,
        returns fill-in arguments for the function and metadata
        related to the data that would be retrieved.

    Raises:
        MemoryOutputNotFoundError: If output from `step_uuid` cannot be
            found.
        OrchestNetworkError: Could not connect to the
            ``Config.STORE_SOCKET_NAME``, because it does not exist.
            Which might be because the specified value was wrong or the
            store died.
    """
    client = _PlasmaConnector().client

    obj_id = _convert_uuid_to_object_id(step_uuid)

    # get metadata of the object if it exists
    metadata = client.get_metadata([obj_id], timeout_ms=0)
    metadata = metadata[0]
    if metadata is None:
        raise error.MemoryOutputNotFoundError(
            f'Output from incoming step "{step_uuid}" cannot be found. '
            "Try rerunning it."
        )
    # this is a pyarrow.Buffer, gotta make it into pybytes to decode,
    # not much overhead given that this is just metadata
    metadata = metadata.to_pybytes()
    metadata = _interpret_metadata(metadata.decode("utf-8"))
    timestamp, serialization, name = metadata

    res = {
        "method_to_call": _get_output_memory,
        "method_args": (step_uuid,),
        "method_kwargs": {"consumer": consumer},
        "metadata": {
            "timestamp": timestamp,
            "serialization": serialization,
            "name": name,
        },
    }
    return res


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
    resolve_methods: List[Callable] = [_resolve_memory, _resolve_disk]

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


def get_inputs(ignore_failure: bool = False, verbose: bool = False) -> Dict[str, Any]:
    """Gets all data sent from incoming steps.

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
          GUI, refer to the :ref:`connections section <connections>`.

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

    Warning:
        Only call :meth:`get_inputs` once! When auto eviction is
        configured data might no longer be available. Either cache the
        data or maintain a copy yourself.

    """
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


def output(data: Any, name: Optional[str]) -> None:
    """Outputs data so that it can be retrieved by the next step.

    It first tries to output to memory and if it does not fit in memory,
    then disk will be used.

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

    Note:
        Calling :meth:`output` multiple times within the same script
        will overwrite the output, even when using a different output
        ``name``. You therefore want to be only calling the function
        once.

    """
    try:
        _check_data_name_validity(name)
    except (ValueError, TypeError) as e:
        raise error.DataInvalidNameError(e)

    return output_to_memory(data, name, disk_fallback=True)


def _convert_uuid_to_object_id(step_uuid: str) -> plasma.ObjectID:
    """Converts a UUID to a plasma.ObjectID.

    Args:
        step_uuid: UUID of a step.

    Returns:
        An ObjectID of the first 20 characters of the `step_uuid`.
    """
    binary_uuid = str.encode(step_uuid)
    return plasma.ObjectID(binary_uuid[:20])


# TODO: Once we are set on the API we could specify __all__. For now we
#       will stick with the leading _underscore convention to indicate
#       private methods.
