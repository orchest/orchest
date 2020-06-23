"""Transfer mechanisms to send and receive data from within steps."""
from datetime import datetime
import json
import os
import pickle
from typing import Any, Dict, List, Optional, Tuple
import urllib

import pyarrow as pa
import pyarrow.plasma as plasma

from orchest.config import (
    get_step_data_dir,
    get_store_socket_name
)
from orchest.errors import (
    DiskOutputNotFoundError,
    OutputNotFoundError,
    MemoryOutputNotFoundError,
    ObjectNotFoundError,
    OrchestNetworkError,
    StepUUIDResolveError
)
from orchest.pipeline import Pipeline


def _send_disk(data: Any,
               full_path: str,
               type: str = 'pickle',
               **kwargs) -> None:
    """Sends data to disk to the specified path.

    Args:
        data: data to send.
        full_path: full path to save the data to.
        type: file extension determining how to save the data to disk.
            Available options are: ``['pickle']``
        **kwargs: these kwargs are passed to the function that handles
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


def send_disk(data: Any,
              type: str = 'pickle',
              pipeline_description_path: str = 'pipeline.json',
              **kwargs) -> None:
    """Sends data to disk.

    To manage sending the data to disk for the user, this function has
    a side effect:

    * Writes to a HEAD file alongside the actual data file. This file
      serves a protocol that returns the timestamp of the latest write
      to disk via this function.

    Args:
        data: data to send.
        type: file extension determining how to save the data to disk.
            Available options are: ``['pickle']``
        **kwargs: these kwargs are passed to the function that handles
            the writing of the data to disk for the specified `type`.
            For example: ``pickle.dump(data, fname, **kwargs)``.

    Example:
        >>> data = 'Data I would like to send'
        >>> send_disk(data)
    """
    with open(pipeline_description_path, 'r') as f:
        pipeline_description = json.load(f)

    pipeline = Pipeline.from_json(pipeline_description)

    try:
        step_uuid = get_step_uuid(pipeline)
    except StepUUIDResolveError:
        raise StepUUIDResolveError('Failed to determine where to send data to.')

    # Recursively create any directories if they do not already exists.
    step_data_dir = get_step_data_dir(step_uuid)
    os.makedirs(step_data_dir, exist_ok=True)

    # The HEAD file serves to resolve the transfer method.
    head_file = os.path.join(step_data_dir, 'HEAD')
    with open(head_file, 'w') as f:
        f.write(f'{datetime.utcnow().isoformat()}, {type}')

    # Full path to write the actual data to.
    full_path = os.path.join(step_data_dir, step_uuid)

    return _send_disk(data, full_path, type=type, **kwargs)


def _receive_disk(full_path: str, type: str = 'pickle', **kwargs) -> Any:
    """Receives data from disk.

    Raises:
        ValueError: If the specified `type` is not one of ``['pickle']``
    """
    if type == 'pickle':
        with open(f'{full_path}.{type}', 'rb') as f:
            return pickle.load(f, **kwargs)

    elif type == 'arrow':
        with open('{full_path}.{type}', 'rb') as f:
            return pa.deserialize_from(f, base=None)

    elif type == 'arrowpickle':
        with open('{full_path}.{type}', 'rb') as f:
            data = pa.deserialize_from(f, base=None)
            return pickle.loads(data)

    raise ValueError("Function not defined for specified 'type'")


def receive_disk(step_uuid: str, type: str = 'pickle', **kwargs) -> Any:
    """Receives data from disk.

    Args:
        step_uuid: the UUID of the step from which to receive its data.
        type: file extension determining how to read the data from disk.
            Available options are: ``['pickle']``

        **kwargs: these kwargs are passed to the function that handles
            the reading of the data from disk for the specified `type`.
            For example: ``pickle.load(fname, **kwargs)``.

    Returns:
        Data from step identified by `step_uuid`.

    Raises:
        DiskOutputNotFoundError: If output from `step_uuid` cannot be found.
    """
    step_data_dir = get_step_data_dir(step_uuid)
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
        step_uuid: the UUID of the step to resolve its most recent write
            to disk.

    Returns:
        Dictionary containing the information of the function to be
        called to receive the most recent data from the step.
        Additionally, returns fill-in arguments for the function.

    Raises:
        DiskOutputNotFoundError: If output from `step_uuid` cannot be found.
    """
    step_data_dir = get_step_data_dir(step_uuid)
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


def _serialize_memory(obj, pickle_fallback=True):
    try:
        # NOTE: experimental pyarrow function ``serialize``
        serialized = pa.serialize(obj)

    except pa.SerializationCallbackError:
        # TODO: this is very inefficient. We decided to pickle the
        #       object if pyarrow can not serialize it for us. However,
        #       there might very well be a better way to write the
        #       pickled object to the buffer instead of serializing the
        #       pickled object again so that we get a SerializedPyObject
        #       (on which we can call certain methods).
        if pickle_fallback:
            serialized = pa.serialize(pickle.dumps(obj))
            metadata = b'pickled'

    else:
        metadata = b'not-pickled'

    return serialized, metadata


def _send_memory(obj: pa.SerializedPyObject,
                 client,
                 obj_id=None,
                 metadata: Optional[bytes] = None,
                 memcopy_threads=6,
                 **kwargs) -> None:
    """Sends data to disk to the specified path.

    Args:
        data: data to send.
        full_path: full path to save the data to.
        type: file extension determining how to save the data to disk.
            Available options are: ``['pickle']``
        **kwargs: these kwargs are passed to the function that handles
            the writing of the data to disk for the specified `type`.
            For example: ``pickle.dump(data, fname, **kwargs)``.

    Raises:
        ValueError: If the specified `type` is not one of ``['pickle']``
    """
    # Check whether the object to be passed in memory, actually fits in
    # memory. We check explicitely instead of trying to insert it,
    # because inserting an already full Plasma store will start evicting
    # objects to free up space. However, we want to maintain control
    # over what objects get evicted.
    total_size = obj.total_bytes + len(metadata)

    occupied_size = sum(
        obj['data_size'] + obj['metadata_size']
        for obj in client.list().values()
    )
    # TODO: maybe use a percentage of maximum capacity. Better be safe
    #       than sorry.
    available_size = client.store_capacity() - occupied_size

    if total_size > available_size:
        raise MemoryError('Object does not fit in memory')

    # Write the object to the Plasma store.
    if obj_id is None:
        obj_id = plasma.ObjectID.from_random()

    buffer = client.create(obj_id, obj.total_bytes, metadata=metadata)
    stream = pa.FixedSizeBufferWriter(buffer)
    stream.set_memcopy_threads(memcopy_threads)

    obj.write_to(stream)
    client.seal(obj_id)

    return obj_id


def send_memory(data: Any,
                pickle_fallback=True,
                disk_fallback=True,
                store_socket_name: str = '/tmp/plasma',
                pipeline_description_path: str = 'pipeline.json',
                **kwargs) -> None:
    """Sends data to disk.

    To manage sending the data to disk for the user, this function has
    a side effect:

    * Writes to a HEAD file alongside the actual data file. This file
      serves a protocol that returns the timestamp of the latest write
      to disk via this function.

    Args:
        data: data to send.
        type: file extension determining how to save the data to disk.
            Available options are: ``['pickle']``
        **kwargs: these kwargs are passed to the function that handles
            the writing of the data to disk for the specified `type`.
            For example: ``pickle.dump(data, fname, **kwargs)``.

    Example:
        >>> data = 'Data I would like to send'
        >>> send_disk(data)
    """
    with open(pipeline_description_path, 'r') as f:
        pipeline_description = json.load(f)

    pipeline = Pipeline.from_json(pipeline_description)

    try:
        step_uuid = get_step_uuid(pipeline)
    except StepUUIDResolveError:
        raise StepUUIDResolveError('Failed to determine where to send data to.')

    # Serialize the object and collect the serialization metadata.
    obj, metadata = _serialize_memory(data, pickle_fallback=pickle_fallback)
    obj_id = _convert_uuid_to_object_id(step_uuid)
    client = plasma.connect(store_socket_name)

    try:
        obj_id = _send_memory(obj, client, obj_id=obj_id, metadata=metadata)

    # TODO: Catch custom error that is raised in _send_memory if the obj
    #       would not fit in plasma store without automatic eviction.
    except MemoryError:
        # TODO: note that metadata is lost when falling back to disk.
        #       Therefore we will only support metadata added by the
        #       user, once disk also supports passing metadata.
        if disk_fallback:
            # TODO: pass on certain kwargs that can be passed to the
            #       pickle module.
            # TODO: since it calls send_disk there should be the
            #       possibility to set some of its kwargs in this method
            #       call.
            # TODO: set custom type so it does not serialize again. Note
            #       that this requires metadata for disk, since otherwise
            #       it does not know whether to use pickle.load after
            #       deserializing the content from the file. OR possibly
            #       do type='arrowpickle' so that from
            #       left to right is resolve order.
            if metadata == b'pickled':
                type_ = 'arrowpickle'
            elif metadata == b'not-pickled':
                type_ = 'arrow'

            return send_disk(
                obj,
                type=type_,
                pipeline_description_path=pipeline_description_path
            )

    return


# TODO: Not yet implemented.
def _get_metadata():
    """Not yet implemented."""
    # Return the metadata that the user added to the object in Plasma.
    # Or added to disk.
    pass


def _receive_memory(obj_id, client, **kwargs) -> Any:
    """Receives data from disk.

    Raises:
        ValueError: If the specified `type` is not one of ``['pickle']``
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
    if metadata == b'pickled':
        obj = pickle.loads(obj)

    return obj


# TODO: I don't think we should expose the store_socket_name here.
#       Probably should just be determined inside this function. Because
#       it has to be mounted at this location. So users that want to use
#       this function inside Orchest do not have the possibility to
#       specify a different socket name. -> Lets put it in the config,
#       because then the test can specify it and the user can do it
#       via a special configuration object.
def receive_memory(step_uuid: str, **kwargs) -> Any:
    """Receives data from disk.

    Args:
        step_uuid: the UUID of the step from which to receive its data.
        type: file extension determining how to read the data from disk.
            Available options are: ``['pickle']``

        **kwargs: these kwargs are passed to the function that handles
            the reading of the data from disk for the specified `type`.
            For example: ``pickle.load(fname, **kwargs)``.

    Returns:
        Data from step identified by `step_uuid`.

    Raises:
        DiskOutputNotFoundError: If output from `step_uuid` cannot be found.
    """
    # TODO: could be good idea to put connecting to plasma in a class
    #       such that does not get called when no store is instantiated
    #       or allocated.
    # TODO: maybe we should only set the client_connection_URI here and
    #       pass the to the _receive_method that then connects to the
    #       client. Since the metadata we can get together with the
    #       buffers.
    client = plasma.connect(get_store_socket_name())
    obj_id = _convert_uuid_to_object_id(step_uuid)

    try:
        return _receive_memory(obj_id, client, **kwargs)
    except ObjectNotFoundError:
        raise MemoryOutputNotFoundError(
            f'Output from incoming step "{step_uuid}" cannot be found. '
            'Try rerunning it.'
        )


def resolve_memory(step_uuid: str) -> Dict[str, Any]:
    """Returns information of the most recent write to disk.

    Resolves via the HEAD file the timestamp (that is used to determine
    the most recent write) and arguments to call the :meth:`receive_disk`
    method.

    Args:
        step_uuid: the UUID of the step to resolve its most recent write
            to disk.

    Returns:
        Dictionary containing the information of the function to be
        called to receive the most recent data from the step.
        Additionally, returns fill-in arguments for the function.

    Raises:
        DiskOutputNotFoundError: If output from `step_uuid` cannot be found.
    """
    client = plasma.connect(get_store_socket_name())
    obj_id = _convert_uuid_to_object_id(step_uuid)

    try:
        # Dictionary from ObjectIDs to an "info" dictionary describing
        # the object.
        info = client.list()[obj_id]

    except KeyError:
        # TODO: this error should be changed. Because if the user did
        #       not send through memory, then maybe he used disk. Thus
        #       here it should not throw an error unless we catch it
        #       ourselves again. -> MemoryOutputNotFoundError
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
        'method_kwargs': {}
    }
    return res


def resolve(step_uuid: str) -> Tuple[Any]:
    """Resolves the most recently used tranfer method of the given step.

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
    global _receive_methods
    # method_info = [method(step_uuid) for method in _receive_methods]

    # TODO: since the resolve methods throw an error the code should
    #       become something like this
    method_infos = []
    for method in _receive_methods:
        try:
            method_info = method(step_uuid)

        # TODO: Define this new custom error
        except OutputNotFoundError:
            # We know now that the user did not use this method to send
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
    most_recent = max(method_infos, key=lambda x: x['timestamp'])
    return (most_recent['method_to_call'],
            most_recent['method_args'],
            most_recent['method_kwargs'])


def receive(pipeline_description_path: str = 'pipeline.json',
            verbose: bool = False) -> List[Any]:
    """Receives all data send from incoming steps.

    Args:
        pipeline_description_path: path to the pipeline description that
            is used to determine what the incoming steps are.
        verbose: if True print all the steps from which the current step
            has received data.

    Returns:
        List of all the data in the specified order from the front-end.

    Example:
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
        receive_method, args, kwargs = resolve(parent_uuid)

        # TODO: The parent_uuid should be inside the *args
        incoming_step_data = receive_method(*args, **kwargs)

        if verbose:
            parent_title = parent.properties['title']
            print(f'Received input from step: "{parent_title}"')

        data.append(incoming_step_data)

    return data


def _convert_uuid_to_object_id(step_uuid):
    binary_uuid = str.encode(str(step_uuid))
    return plasma.ObjectID(binary_uuid[:20])


def get_step_uuid(pipeline: Pipeline) -> str:
    """Gets the currently running script's step UUID.

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


# TODO: shouldn't the name be "_resolve_methods" ?
# NOTE: All "resolve_{method}" functions have to be included in this
# list.
_receive_methods = [
    resolve_disk,
    resolve_memory
]

# TODO: Once we are set on the API we could specify __all__. For now we
#       will stick with the leading _underscore convenction to keep
#       methods private.
