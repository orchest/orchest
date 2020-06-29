"""Transfer mechanisms to output and receive data.

Using memory transfer requires running a Plasma Store. One can be
started using

.. code-block:: bash

    plasma_store -m 1000000000 -s /tmp/plasma

TODO: something about our plasma manager for eviction.

"""
from datetime import datetime
import json
import os
import pickle
from typing import Any, Dict, List, Optional, Tuple
import urllib

import pyarrow as pa
import pyarrow.plasma as plasma

from orchest import Config
from orchest.errors import (
    DiskOutputNotFoundError,
    OutputNotFoundError,
    MemoryOutputNotFoundError,
    ObjectNotFoundError,
    OrchestNetworkError,
    StepUUIDResolveError
)
from orchest.pipeline import Pipeline


def _output_to_disk(data: Any,
                    full_path: str,
                    type: str = 'pickle',
                    **kwargs) -> None:
    """Outputs data to disk to the specified path.

    Args:
        data: Data to output.
        full_path: Full path to save the data to.
        type: File extension determining how to save the data to disk.
            Available options are: ``['pickle']``
        **kwargs: These kwargs are passed to the function that handles
            the writing of the data to disk for the specified `type`.
            For example: ``pickle.dump(data, fname, **kwargs)``.

    Raises:
        ValueError: If the specified `type` is not one of ``['pickle']``
    """
    if type == 'pickle':
        with open(f'{full_path}.{type}', 'wb') as f:
            pickle.dump(data, f, **kwargs)

    elif type in ['arrow', 'arrowpickle']:
        if isinstance(data, pa.SerializedPyObject):
            with open(f'{full_path}.{type}', 'wb') as f:
                data.write_to(f)
        else:
            raise TypeError(
                "Input type of 'data' has to be pa.SerializedPyObject "
                "for 'type' of 'arrow'."
            )

    else:
        raise ValueError("Function not defined for specified 'type'")

    return


def output_to_disk(data: Any,
                   type: str = 'pickle',
                   pipeline_description_path: str = 'pipeline.json',
                   **kwargs) -> None:
    """Outputs data to disk.

    To manage outputing the data to disk for the user, this function has
    a side effect:

    * Writes to a HEAD file alongside the actual data file. This file
      serves a protocol that returns the timestamp of the latest write
      to disk via this function.

    Args:
        data: Data to output.
        type: File extension determining how to save the data to disk.
            Available options are: ``['pickle']``
        pipeline_description_path: Path to the file that contains the
            pipeline description.
        **kwargs: These kwargs are passed to the function that handles
            the writing of the data to disk for the specified `type`.
            For example: ``pickle.dump(data, fname, **kwargs)``.

    Example:
        >>> data = 'Data I would like to output'
        >>> output_to_disk(data)
    """
    with open(pipeline_description_path, 'r') as f:
        pipeline_description = json.load(f)

    pipeline = Pipeline.from_json(pipeline_description)

    try:
        step_uuid = get_step_uuid(pipeline)
    except StepUUIDResolveError:
        raise StepUUIDResolveError('Failed to determine where to output data to.')

    # Recursively create any directories if they do not already exists.
    step_data_dir = Config.get_step_data_dir(step_uuid)
    os.makedirs(step_data_dir, exist_ok=True)

    # The HEAD file serves to resolve the transfer method.
    head_file = os.path.join(step_data_dir, 'HEAD')
    with open(head_file, 'w') as f:
        current_time = datetime.utcnow()
        f.write(f'{current_time.isoformat(timespec="seconds")}, {type}')

    # Full path to write the actual data to.
    full_path = os.path.join(step_data_dir, step_uuid)

    return _output_to_disk(data, full_path, type=type, **kwargs)


def _receive_disk(full_path: str, type: str = 'pickle', **kwargs) -> Any:
    """Receives data from disk.

    Raises:
        ValueError: If the specified `type` is not one of ``['pickle']``
    """
    if type == 'pickle':
        with open(f'{full_path}.{type}', 'rb') as f:
            return pickle.load(f, **kwargs)

    elif type == 'arrow':
        with open(f'{full_path}.{type}', 'rb') as f:
            return pa.deserialize_from(f, base=None)

    elif type == 'arrowpickle':
        with open(f'{full_path}.{type}', 'rb') as f:
            data = pa.deserialize_from(f, base=None)
            return pickle.loads(data)

    raise ValueError("Function not defined for specified 'type'")


def receive_disk(step_uuid: str, type: str = 'pickle', **kwargs) -> Any:
    """Receives data from disk.

    Args:
        step_uuid: The UUID of the step from which to receive its data.
        type: File extension determining how to read the data from disk.
            Available options are: ``['pickle']``
        **kwargs: These kwargs are passed to the function that handles
            the reading of the data from disk for the specified `type`.
            For example: ``pickle.load(fname, **kwargs)``.

    Returns:
        Data from step identified by `step_uuid`.

    Raises:
        DiskOutputNotFoundError: If output from `step_uuid` cannot be found.
    """
    step_data_dir = Config.get_step_data_dir(step_uuid)
    full_path = os.path.join(step_data_dir, step_uuid)

    try:
        return _receive_disk(full_path, type=type, **kwargs)
    except FileNotFoundError:
        # TODO: Ideally we want to provide the user with the step's
        #       name instead of UUID.
        raise DiskOutputNotFoundError(
            f'Output from incoming step "{step_uuid}" cannot be found. '
            'Try rerunning it.'
        )


# TODO: maybe should add the option to specify custom step_data_dir
def resolve_disk(step_uuid: str) -> Dict[str, Any]:
    """Returns information of the most recent write to disk.

    Resolves via the HEAD file the timestamp (that is used to determine
    the most recent write) and arguments to call the :meth:`receive_disk`
    method.

    Args:
        step_uuid: The UUID of the step to resolve its most recent write
            to disk.

    Returns:
        Dictionary containing the information of the function to be
        called to receive the most recent data from the step.
        Additionally, returns fill-in arguments for the function.

    Raises:
        DiskOutputNotFoundError: If output from `step_uuid` cannot be found.
    """
    step_data_dir = Config.get_step_data_dir(step_uuid)
    head_file = os.path.join(step_data_dir, 'HEAD')

    try:
        with open(head_file, 'r') as f:
            timestamp, type = f.read().split(', ')

    except FileNotFoundError:
        # TODO: Ideally we want to provide the user with the step's
        #       name instead of UUID.
        raise DiskOutputNotFoundError(
            f'Output from incoming step "{step_uuid}" cannot be found. '
            'Try rerunning it.'
        )

    res = {
        'timestamp': timestamp,
        'method_to_call': receive_disk,
        'method_args': (step_uuid,),
        'method_kwargs': {
            'type': type
        }
    }
    return res


def _serialize_memory(
    obj: Any,
    pickle_fallback: bool = True
) -> Tuple[pa.SerializedPyObject, bytes]:
    """Serializes an object using ``pyarrow.serialize``.

    Args:
        obj: The object/data to be serialized.
        pickle_fallback: True to use ``pickle`` as fallback
            serialization if pyarrow cannot serialize the object. False
            to not fall back on ``pickle``.
    """
    try:
        # NOTE: experimental pyarrow function ``serialize``
        serialized = pa.serialize(obj)

    except pa.SerializationCallbackError as e:
        # TODO: this is very inefficient. We decided to pickle the
        #       object if pyarrow can not serialize it for us. However,
        #       there might very well be a better way to write the
        #       pickled object to the buffer instead of serializing the
        #       pickled object again so that we get a SerializedPyObject
        #       (on which we can call certain methods).
        if pickle_fallback:
            serialized = pa.serialize(pickle.dumps(obj))
            metadata = b'1;pickled'
        else:
            raise pa.SerializationCallbackError(e)

    else:
        metadata = b'1;not-pickled'

    return serialized, metadata


def _output_to_memory(obj: pa.SerializedPyObject,
                      client: plasma.PlasmaClient,
                      obj_id: Optional[plasma.ObjectID] = None,
                      metadata: Optional[bytes] = None,
                      memcopy_threads: int = 6) -> plasma.ObjectID:
    """Outputs an object to memory, managed by the Arrow Plasma Store.

    Args:
        obj: Object to output.
        client: A PlasmaClient to interface with a plasma store and
            manager.
        obj_id: The ID to assign to the `obj` inside the plasma store.
            If None is given then one is randomly generated.
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
    total_size = obj.total_bytes + len(metadata)

    occupied_size = sum(
        obj['data_size'] + obj['metadata_size']
        for obj in client.list().values()
    )
    # NOTE: TODO: do this percentage since we output a special object
    #       to do eviction. And there should always be space for this
    #       object.
    # TODO: maybe use a percentage of maximum capacity. Better be safe
    #       than sorry.
    available_size = client.store_capacity() - occupied_size

    if total_size > available_size:
        raise MemoryError('Object does not fit in memory')

    # In case no `obj_id` is specified, one has to be generated because
    # an ID is required for an object to be inserted in the store.
    if obj_id is None:
        obj_id = plasma.ObjectID.from_random()

    # Write the object to the plasma store. If the obj_id already
    # exists, then it first has to be deleted. Essentially we are
    # overwriting the data (just like we do for disk)
    try:
        buffer = client.create(obj_id, obj.total_bytes, metadata=metadata)
    except plasma.PlasmaObjectExists:
        client.delete([obj_id])
        buffer = client.create(obj_id, obj.total_bytes, metadata=metadata)

    stream = pa.FixedSizeBufferWriter(buffer)
    stream.set_memcopy_threads(memcopy_threads)

    obj.write_to(stream)
    client.seal(obj_id)

    return obj_id


def output_to_memory(data: Any,
                     pickle_fallback: bool = True,
                     disk_fallback: bool = True,
                     store_socket_name: str = '/tmp/plasma',
                     pipeline_description_path: str = 'pipeline.json',
                     **kwargs) -> None:
    """Outputs data to memory, managed by the Arrow Plasma Store.

    To manage outputing the data to memory for the user, this function
    uses metadata to add info to objects inside the plasma store.

    Args:
        data: Data to output.
        pickle_fallback: True to use ``pickle`` as fallback in case the
            data cannot be serialized by ``pyarrow.serialize``.
        disk_fallback: If True, then outputing to disk is used when the
            `data` does not fit in memory. If False, then a
            :exc:`MemoryError` is thrown.
        store_socket_name: Name of the socket file of the plasma store.
            It is used to connect the plasma client.
        pipeline_description_path: Path to the file that contains the
            pipeline description.
        **kwargs: These kwargs are passed to the :func:`output_to_disk`
            function in case of a triggered `disk_fallback`.

    Raises:
        MemoryError: If the `data` does not fit in memory and
            ``disk_fallback=False``.

    Example:
        >>> data = 'Data I would like to output'
        >>> output_to_memory(data)
    """
    with open(pipeline_description_path, 'r') as f:
        pipeline_description = json.load(f)

    pipeline = Pipeline.from_json(pipeline_description)

    try:
        step_uuid = get_step_uuid(pipeline)
    except StepUUIDResolveError:
        raise StepUUIDResolveError('Failed to determine where to output data to.')

    # Serialize the object and collect the serialization metadata.
    obj, metadata = _serialize_memory(data, pickle_fallback=pickle_fallback)
    obj_id = _convert_uuid_to_object_id(step_uuid)

    # TODO: Get the store socket name from the Config. And pass it to
    #       _output_to_memory which will then connect to it. Although better
    #       if it connects more high level since otherwise if you want
    #       to use low-level the code will connect everytime instead of
    #       being able to reuse the same client. But still good idea to
    #       get it from the config in this function. Maybe set the kwarg
    #       to None default, so that if it is None then use config and
    #       otherwise the given value.
    client = plasma.connect(store_socket_name)

    try:
        obj_id = _output_to_memory(obj, client, obj_id=obj_id, metadata=metadata)

    except MemoryError:
        if not disk_fallback:
            raise MemoryError('Data does not fit in memory.')

        # TODO: note that metadata is lost when falling back to disk.
        #       Therefore we will only support metadata added by the
        #       user, once disk also supports passing metadata.
        # TODO: pass on certain kwargs that can be passed to the
        #       pickle module.
        # TODO: since it calls output_to_disk there should be the
        #       possibility to set some of its kwargs in this method
        #       call.
        if metadata == b'1;pickled':
            type_ = 'arrowpickle'
        elif metadata == b'1;not-pickled':
            type_ = 'arrow'

        return output_to_disk(
            obj,
            type=type_,
            pipeline_description_path=pipeline_description_path,
            **kwargs
        )

    return


def _receive_memory(obj_id: plasma.ObjectID,
                    client: plasma.PlasmaClient) -> Any:
    """Receives data from memory.

    Args:
        obj_id: The ID of the object to retrieve from the plasma store.
        client: A PlasmaClient to interface with a plasma store and
            manager.

    Returns:
        The unserialized data from the store, corresponding to the
        `obj_id`.

    Raises:
        ObjectNotFoundError: If the specified `obj_id` is not in the
            store.
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
        raise ObjectNotFoundError(
            f'Object with ObjectID "{obj_id}" does not exist in store.'
        )

    buffers_bytes = buffer.to_pybytes()
    obj = pa.deserialize(buffers_bytes)

    # If the metadata stated that the object was pickled, then we need
    # to additionally unpickle the obj.
    if metadata == b'1;pickled':
        obj = pickle.loads(obj)

    return obj


def receive_memory(step_uuid: str, receiver: str = None) -> Any:
    """Receives data from memory, managed by the Arrow Plasma Store.

    Args:
        step_uuid: The UUID of the step from which to receive its data.

    Returns:
        Data from step identified by `step_uuid`.

    Raises:
        MemoryOutputNotFoundError: If output from `step_uuid` cannot be found.
    """
    # TODO: could be good idea to put connecting to plasma in a class
    #       such that does not get called when no store is instantiated
    #       or allocated.
    # TODO: maybe we should only set the client_connection_URI here and
    #       pass the to the _receive_method that then connects to the
    #       client. Since the metadata we can get together with the
    #       buffers.
    client = plasma.connect(Config.STORE_SOCKET_NAME)
    obj_id = _convert_uuid_to_object_id(step_uuid)

    try:
        obj = _receive_memory(obj_id, client)

    # TODO: if a step receives from multiple other steps. Then this
    #       error will make the entire receive operation fail. Thus
    #       having done all the deserialization of the other steps for
    #       nothing. Maybe we can do a check beforehand so we can throw
    #       this error earlier.
    except ObjectNotFoundError:
        raise MemoryOutputNotFoundError(
            f'Output from incoming step "{step_uuid}" cannot be found. '
            'Try rerunning it.'
        )

    else:
        # TODO: note somewhere (maybe in the docstring) that it might
        #       although very unlikely raise MemoryError, because the
        #       receive is now actually also outputing data.
        # TODO: output message to plasma if received from memory to do the
        #       eviction.
        # TODO: this ENV variable is set in the orchest-api. Now we
        #       always know when we are running inside a jupyter kernel
        #       interactively. And in that case we never want to do
        #       eviction.
        if os.getenv('PLASMA_MANAGER') is not None:
            empty_obj, _ = _serialize_memory('')
            msg = f'2;{step_uuid},{receiver}'
            metadata = bytes(msg, 'utf-8')
            _output_to_memory(empty_obj, client, metadata=metadata)

    return obj


def resolve_memory(step_uuid: str, receiver: str = None) -> Dict[str, Any]:
    """Returns information of the most recent write to memory.

    Resolves via the `create_time` attribute from the info of a plasma
    store entry the timestamp. It also sets the arguments to call the
    :func:`receive_memory` method.

    Args:
        step_uuid: The UUID of the step to resolve its most recent write
            to memory.

    Returns:
        Dictionary containing the information of the function to be
        called to receive the most recent data from the step.
        Additionally, returns fill-in arguments for the function.

    Raises:
        MemoryOutputNotFoundError: If output from `step_uuid` cannot be found.
    """
    client = plasma.connect(Config.STORE_SOCKET_NAME)
    obj_id = _convert_uuid_to_object_id(step_uuid)

    try:
        # Dictionary from ObjectIDs to an "info" dictionary describing
        # the object.
        info = client.list()[obj_id]

    except KeyError:
        raise MemoryOutputNotFoundError(
            f'Output from incoming step "{step_uuid}" cannot be found. '
            'Try rerunning it.'
        )

    ts = info['create_time']
    timestamp = datetime.utcfromtimestamp(ts).isoformat()

    res = {
        'timestamp': timestamp,
        'method_to_call': receive_memory,
        'method_args': (step_uuid,),
        'method_kwargs': {
            'receiver': receiver
        }
    }
    return res


def resolve(step_uuid: str, receiver: str = None) -> Tuple[Any]:
    """Resolves the most recently used tranfer method of the given step.

    Additionally, resolves all the *args and **kwargs the receiving
    transfer method has to be called with.

    Args:
        step_uuid: UUID of the step to resolve its most recent write.

    Returns:
        Tuple containing the information of the function to be called
        to receive the most recent data from the step. Additionally,
        returns fill-in arguments for the function.
    """
    # TODO: not completely sure whether this global approach is prefered
    #       over difining that same list inside this function. Arguably
    #       defining it outside the function allows for easier
    #       extendability.
    global _resolve_methods

    method_infos = []
    for method in _resolve_methods:
        try:
            if method.__name__ == 'resolve_memory':
                method_info = method(step_uuid, receiver=receiver)
            else:
                method_info = method(step_uuid)

        except OutputNotFoundError:
            # We know now that the user did not use this method to output
            # thus we can just skip it and continue.
            pass
        else:
            method_infos.append(method_info)

    # If no info could be collected, then the previous step has not yet
    # been executed.
    if not method_infos:
        raise OutputNotFoundError(
            f'Output from incoming step "{step_uuid}" cannot be found. '
            'Try rerunning it.'
        )

    # Get the method that was most recently used based on its logged
    # timestamp.
    # NOTE: if multiple methods have the same timestamp then the method
    # that is highest in the `_resolve_methods` list will be returned.
    # Since `max` returns the first occurrence of the maximum value.
    most_recent = max(method_infos, key=lambda x: x['timestamp'])
    return (most_recent['method_to_call'],
            most_recent['method_args'],
            most_recent['method_kwargs'])


def receive(pipeline_description_path: str = 'pipeline.json',
            verbose: bool = False) -> List[Any]:
    """Receives all data sent from incoming steps.

    Args:
        pipeline_description_path: Path to the pipeline description that
            is used to determine what the incoming steps are.
        verbose: If True print all the steps from which the current step
            has received data.

    Returns:
        List of all the data in the specified order from the front-end.

    Example:
        >>> # It does not matter how the data was output in steps 1 and 2.
        >>> # It is resolved automatically by the receive method.
        >>> data_step_1, data_step_2 = receive()
    """
    with open(pipeline_description_path, 'r') as f:
        pipeline_description = json.load(f)

    pipeline = Pipeline.from_json(pipeline_description)
    try:
        step_uuid = get_step_uuid(pipeline)
    except StepUUIDResolveError:
        raise StepUUIDResolveError('Failed to determine from where to receive data.')

    # TODO: maybe instead of for loop we could first get the receive
    #       method and then do batch receive. For example memory allows
    #       to do get_buffers which operates in batch.
    # NOTE: the order in which the `parents` list is traversed is
    # indirectly set in the UI. The order is important since it
    # determines the order in which the inputs are received in the next
    # step.
    data = []
    for parent in pipeline.get_step_by_uuid(step_uuid).parents:
        parent_uuid = parent.properties['uuid']
        receive_method, args, kwargs = resolve(parent_uuid, receiver=step_uuid)

        incoming_step_data = receive_method(*args, **kwargs)

        if verbose:
            parent_title = parent.properties['title']
            print(f'Received input from step: "{parent_title}"')

        data.append(incoming_step_data)

    return data


def _convert_uuid_to_object_id(step_uuid: str) -> plasma.ObjectID:
    """Converts a UUID to a plasma.ObjectID.

    Args:
        step_uuid: UUID of a step.

    Returns:
        An ObjectID of the first 20 characters of the `step_uuid`.
    """
    binary_uuid = str.encode(step_uuid)
    return plasma.ObjectID(binary_uuid[:20])


def get_step_uuid(pipeline: Pipeline) -> str:
    """Gets the currently running script's step UUID.

    Args:
        pipeline: Pipeline object describing the pipeline and its steps.

    Returns:
        The UUID of the currently running step. May it be through an
        active Jupyter kernel or as part of a partial run.

    Raises:
        StepUUIDResolveError: The step's UUID cannot be resolved.
    """
    # In case of partial runs, the step UUID can be obtained via the
    # environment.
    if 'STEP_UUID' in os.environ:
        return os.environ['STEP_UUID']

    # The KERNEL_ID environment variable is set by the Jupyter
    # Enterprise Gateway.
    kernel_id = os.environ.get('KERNEL_ID')
    if kernel_id is None:
        raise StepUUIDResolveError('Environment variable "KERNEL_ID" not present.')

    # Get JupyterLab sessions to resolve the step's UUID via the id of
    # the running kernel and the step's associated file path. This
    # requires an authenticated request, which is obtained by requesting
    # the token via the Orchest API.
    # Orchest API --token--> Jupyter sessions --notebook path--> UUID.
    launches_url = f'http://orchest-api/api/launches/{pipeline.properties["uuid"]}'
    launch_data = _request_json(launches_url)

    jupyter_api_url = 'http://{ip}:{port}/{proxy_prefix}/api/sessions?token={token}'
    jupyter_api_url = jupyter_api_url.format(
        ip=launch_data['server_ip'],
        port=launch_data['server_info']['port'],
        proxy_prefix='jupyter_' + launch_data['server_ip'].replace('.', '_'),
        token=launch_data['server_info']['token']
    )
    jupyter_sessions = _request_json(jupyter_api_url)

    for session in jupyter_sessions:
        if session['kernel']['id'] == kernel_id:
            notebook_path = session['notebook']['path']
            break
    else:
        raise StepUUIDResolveError(
            f'Jupyter session data has no "kernel" with "id" equal to the '
            '"KERNEL_ID" of this step: {kernel_id}.'
        )

    for step in pipeline.steps:
        if step.properties['file_path'] == notebook_path:
            # NOTE: the UUID cannot be cached here. Because if the
            # notebook is assigned to a different step, then the env
            # variable does not change and thus the notebooks wrongly
            # thinks it is a different step.
            return step.properties['uuid']

    raise StepUUIDResolveError('No step with "notebook_path": {notebook_path}.')


def _request_json(url: str) -> Dict[Any, Any]:
    """Requests response from specified url and jsonifies it."""
    try:
        with urllib.request.urlopen(url) as r:
            encoding = r.info().get_param('charset')
            data = r.read()
    except urllib.error.URLError:
        raise OrchestNetworkError(
            f'Failed to fetch data from {url}. Either the specified server '
            'does not exist or the network connection could not be established.'
        )
    except urllib.error.HTTPError:
        raise OrchestNetworkError(
            f'Failed to fetch data from {url}. The server could not fulfil the request.'
        )

    encoding = encoding or 'utf-8'
    data = data.decode(encoding or 'utf-8')

    return json.loads(data)


# NOTE: All "resolve_{method}" functions have to be included in this
# list. It is used to resolve what what "receive_..." method to invoke.
_resolve_methods = [
    resolve_memory,
    resolve_disk
]

# TODO: Once we are set on the API we could specify __all__. For now we
#       will stick with the leading _underscore convenction to keep
#       methods private.
